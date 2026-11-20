"""Label each advisory's attack class with a language model.

The advisories carry official CWE codes, but those are generic, often missing,
and have no way to express an AI-specific risk such as a malicious checkpoint
or a prompt-injected tool call. This step reads each advisory's own text and
assigns a consistent label, which is what makes the AI-specific counts on the
site possible at all.

Three providers, one interface:

    meta       Meta Model API (Muse). OpenAI-compatible, so this uses the
               openai SDK pointed at a different base URL.
    anthropic  The Anthropic Messages API.
    keyword    No network and no cost. A crude rule-based pass, which is what
               produced the labels currently marked "preliminary" on the site.

Run from the repository root:

    python3 -m pipeline.enrich --provider meta --model muse-spark-1.3
    python3 -m pipeline.enrich --provider meta --dry-run      # cost estimate

Every response is cached to disk by advisory id, so an interrupted run resumes
for free and a re-run spends nothing. Labels are written back into the
advisories CSV along with `label_source`, which is what the site reads to
decide whether to show the "Preliminary label" warning.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import shutil
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from . import config

CACHE_DIR = config.PHASE3_DIR / "enrichment_cache"

# Meta's published defaults. The base URL and model ids come from
# dev.meta.ai/docs; override either on the command line if they move.
META_BASE_URL = "https://api.meta.ai/v1"
META_DEFAULT_MODEL = "muse-spark-1.3"

# Muse Spark reasons before answering and those tokens count against the cap,
# so the budget has to cover reasoning AND the JSON. At 1500 the longest
# advisories spent the lot on reasoning and returned empty content. Billing is
# on tokens actually produced, so headroom costs nothing on the easy ones.
MAX_COMPLETION_TOKENS = 4000
# Second try for an advisory that still reasoned past the cap.
ESCALATED_COMPLETION_TOKENS = 12000
ANTHROPIC_DEFAULT_MODEL = "claude-haiku-5-5"

ENTRY_POINTS = [
    "model file",
    "user prompt or document",
    "web interface or server",
    "agent tool connection",
    "dependency",
    "other",
]

SYSTEM = """You label security advisories for open-source Python AI libraries.

Return ONLY a JSON object, no prose and no code fence, with exactly these keys:

  attack_class        one of: {classes}
  ai_specific         true only if the flaw exists BECAUSE the software runs
                      models or agents. A classic web or parsing bug in an AI
                      library is false. Unsafe deserialization of a model
                      checkpoint, or acting on model output, is true.
  entry_point         one of: {entries}
  one_line_summary    plain English, under 20 words, no vendor marketing

Choose "other" for attack_class only when nothing else fits. Prefer the most
specific class the advisory text actually supports; do not infer a class from
the package name alone."""

USER = """Package: {package}
Summary: {summary}
CWE codes: {cwes}

Description:
{description}"""


class ProviderRefused(RuntimeError):
    """The model returned no content and trying again will not change that."""

    retryable = False


@dataclass
class Result:
    attack_class: str
    ai_specific: bool
    entry_point: str
    one_line_summary: str


def _coerce(raw: str) -> Result:
    """Parse the model's reply, tolerating a stray code fence."""
    text = raw.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.S)
    if fence:
        text = fence.group(1)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"no JSON object in reply: {raw[:120]!r}")
    data = json.loads(text[start : end + 1])

    attack = str(data.get("attack_class", "")).strip().lower()
    if attack not in config.ATTACK_CLASS_ORDER:
        attack = "other"
    entry = str(data.get("entry_point", "")).strip().lower()
    if entry not in ENTRY_POINTS:
        entry = "other"
    flag = data.get("ai_specific")
    if isinstance(flag, str):
        flag = flag.strip().lower() in {"true", "yes", "1"}

    return Result(
        attack_class=attack,
        ai_specific=bool(flag),
        entry_point=entry,
        one_line_summary=str(data.get("one_line_summary", "")).strip()[:200],
    )


# --- providers -------------------------------------------------------------

class MetaProvider:
    """Meta Model API. OpenAI-compatible, so the openai SDK works unchanged
    apart from the base URL. The key is read explicitly rather than left to
    the SDK, which would otherwise pick up an unrelated OPENAI_API_KEY."""

    label = "Meta Model API"

    def __init__(self, model: str, base_url: str) -> None:
        try:
            from openai import OpenAI
        except ImportError:  # pragma: no cover
            raise SystemExit(
                "The openai package is required for --provider meta.\n"
                "  pip install openai"
            )
        key = os.environ.get("MODEL_API_KEY")
        if not key:
            raise SystemExit(
                "MODEL_API_KEY is not set.\n"
                "  1. Generate a key at dev.meta.ai\n"
                f"  2. Put it in {config.PROJECT_DIR / '.env'} as:\n"
                "       MODEL_API_KEY=your-key-here\n"
                "  .env is gitignored. An exported variable overrides it."
            )
        self.model = model
        # A laptop that sleeps mid-run wakes with dead sockets. Without a
        # timeout the SDK waits ten minutes per call before retrying, so
        # every worker hangs and the run looks alive while doing nothing.
        # Sixty seconds is well clear of a real call and fails a dead one
        # fast enough for the retry to open a fresh connection.
        self._client = OpenAI(
            base_url=base_url, api_key=key, timeout=60.0, max_retries=4
        )

    def __call__(self, system: str, user: str) -> str:
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        caps = (MAX_COMPLETION_TOKENS, ESCALATED_COMPLETION_TOKENS)
        for i, cap in enumerate(caps):
            reply = self._client.chat.completions.create(
                model=self.model,
                temperature=0,
                max_completion_tokens=cap,
                messages=messages,
            )
            choice = reply.choices[0]
            text = choice.message.content or ""
            if text.strip():
                return text

            # Empty content. Why decides whether a bigger budget would help.
            reason = choice.finish_reason
            used = getattr(reply.usage, "completion_tokens", None)
            if reason != "length":
                raise ProviderRefused(
                    f"empty reply, finish_reason={reason!r}, "
                    f"completion_tokens={used}"
                )
            if i == len(caps) - 1:
                raise ProviderRefused(
                    f"empty reply at {cap} tokens: reasoning used the whole "
                    f"budget (completion_tokens={used})"
                )
            # Reasoning ate the budget before writing the JSON. Try once more
            # with room to finish rather than burning the outer retries.
        raise AssertionError("unreachable")


class AnthropicProvider:
    label = "Anthropic Messages API"

    def __init__(self, model: str, base_url: str | None = None) -> None:
        try:
            import anthropic
        except ImportError:  # pragma: no cover
            raise SystemExit("pip install anthropic")
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise SystemExit(
                "ANTHROPIC_API_KEY is not set.\n"
                f"  Add it to {config.PROJECT_DIR / '.env'}."
            )
        self.model = model
        self._client = anthropic.Anthropic()

    def __call__(self, system: str, user: str) -> str:
        reply = self._client.messages.create(
            model=self.model,
            max_tokens=1500,
            temperature=0,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return "".join(b.text for b in reply.content if b.type == "text")


KEYWORDS: list[tuple[str, str, bool]] = [
    (r"deserial|pickle|unsafe load|torch\.load|checkpoint|safetensors|lambda layer",
     "unsafe model or file loading", True),
    (r"prompt inject|jailbreak|model output|tool poison|indirect injection",
     "prompt injection or unsafe model output", True),
    (r"remote code execution|command inject|rce|eval\(|arbitrary code|sql inject",
     "code, command or query injection", False),
    (r"path traversal|directory traversal|arbitrary file|zip slip|file read",
     "path traversal or file access", False),
    (r"ssrf|server-side request", "server-side request forgery", False),
    (r"auth|permission|access control|privilege|token leak",
     "authentication or authorization", False),
    (r"denial of service|dos\b|redos|resource exhaust|infinite loop",
     "denial of service", False),
    (r"cross-site|xss|csrf|open redirect",
     "web flaw (scripting, request forgery, redirects)", False),
    (r"information disclos|leak|expose", "information disclosure", False),
]


class KeywordProvider:
    """The no-network fallback. Deliberately crude, and labelled as such."""

    label = "keyword fallback (preliminary)"

    def __init__(self, *_args, **_kwargs) -> None:
        self.model = "keyword rules"

    def __call__(self, system: str, user: str) -> str:
        text = user.lower()
        for pattern, cls, ai in KEYWORDS:
            if re.search(pattern, text):
                return json.dumps({
                    "attack_class": cls, "ai_specific": ai,
                    "entry_point": "other", "one_line_summary": "",
                })
        return json.dumps({
            "attack_class": "other", "ai_specific": False,
            "entry_point": "other", "one_line_summary": "",
        })


PROVIDERS = {"meta": MetaProvider, "anthropic": AnthropicProvider,
             "keyword": KeywordProvider}
DEFAULT_MODEL = {"meta": META_DEFAULT_MODEL, "anthropic": ANTHROPIC_DEFAULT_MODEL,
                 "keyword": "keyword rules"}


# --- orchestration ---------------------------------------------------------

def _cache_path(advisory_id: str, model: str) -> Path:
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", f"{model}__{advisory_id}")
    return CACHE_DIR / f"{safe}.json"


def _label_one(row, provider, model: str, retries: int = 4) -> Result:
    cached = _cache_path(row.advisory_id, model)
    if cached.exists():
        try:
            return Result(**json.loads(cached.read_text()))
        except (json.JSONDecodeError, TypeError):
            pass  # a truncated cache entry just gets refetched

    user = USER.format(
        package=row.package,
        summary=row.summary,
        cwes=", ".join(row.weakness_list) or "none recorded",
        # The description carries the detail the label depends on, but a few
        # run to thousands of words and the tail is usually credits.
        description=str(row.description)[:4000],
    )
    system = SYSTEM.format(
        classes=", ".join(config.ATTACK_CLASS_ORDER),
        entries=", ".join(ENTRY_POINTS),
    )

    last: Exception | None = None
    for attempt in range(retries):
        try:
            result = _coerce(provider(system, user))
            cached.parent.mkdir(parents=True, exist_ok=True)
            cached.write_text(json.dumps(result.__dict__))
            return result
        except Exception as exc:  # noqa: BLE001 - provider SDKs raise broadly
            last = exc
            # A refusal or an exhausted budget repeats identically at
            # temperature 0, so retrying it only costs tokens.
            if attempt == retries - 1 or not getattr(exc, "retryable", True):
                break
            time.sleep(2**attempt)  # 1s, 2s, 4s
    raise RuntimeError(f"{row.advisory_id}: {last}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--provider", choices=sorted(PROVIDERS), default="meta")
    ap.add_argument("--model", default=None, help="defaults per provider")
    ap.add_argument("--base-url", default=META_BASE_URL)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--limit", type=int, default=None, help="label only the first N")
    ap.add_argument("--only", default=None,
                    help="comma-separated advisory ids, for probing failures")
    ap.add_argument("--dry-run", action="store_true",
                    help="report what would be called and roughly what it costs")
    args = ap.parse_args(argv)

    model = args.model or DEFAULT_MODEL[args.provider]

    from .load import load_advisories
    advisories = load_advisories()

    # One call per advisory, not per row: an advisory affecting langchain and
    # langchain-core is one piece of text and one label.
    unique = advisories.drop_duplicates(subset="advisory_id")
    if args.only:
        wanted = {i.strip() for i in args.only.split(",") if i.strip()}
        unique = unique[unique.advisory_id.isin(wanted)]
        missing = wanted - set(unique.advisory_id)
        if missing:
            print(f"not in the data: {', '.join(sorted(missing))}", file=sys.stderr)
    if args.limit:
        unique = unique.head(args.limit)

    todo = [r for r in unique.itertuples()
            if not _cache_path(r.advisory_id, model).exists()]
    cached_n = len(unique) - len(todo)

    print(f"provider   {args.provider} ({PROVIDERS[args.provider].label})")
    print(f"model      {model}")
    print(f"advisories {len(unique)} unique, {len(advisories)} rows")
    print(f"cached     {cached_n} already labelled, {len(todo)} to call")

    if args.dry_run:
        # Rough, and stated as rough. Meta's published Spark Standard rate.
        in_tok = sum(min(len(str(r.description)), 4000) // 4 + 220 for r in todo)
        out_tok = len(todo) * 110
        print(f"\nestimate   ~{in_tok:,} input + ~{out_tok:,} output tokens")
        print(f"           ~${in_tok/1e6*1.25 + out_tok/1e6*4.25:.2f} at "
              f"$1.25/$4.25 per 1M (Meta Spark Standard, check current rates)")
        print("\nnothing was called. Drop --dry-run to run it.")
        return 0

    if todo:
        provider = PROVIDERS[args.provider](model, args.base_url)
        done, failed = 0, []
        started = time.monotonic()
        with concurrent.futures.ThreadPoolExecutor(args.workers) as pool:
            futures = {pool.submit(_label_one, r, provider, model): r for r in todo}
            for fut in concurrent.futures.as_completed(futures):
                row = futures[fut]
                try:
                    fut.result()
                except Exception as exc:  # noqa: BLE001
                    failed.append(str(exc))
                done += 1
                if done % 10 == 0 or done == len(todo):
                    elapsed = time.monotonic() - started
                    rate = done / elapsed
                    left = (len(todo) - done) / rate if rate else 0
                    print(f"  {done}/{len(todo)}  {rate*60:.0f}/min  "
                          f"{elapsed/60:.1f}m elapsed, ~{left/60:.1f}m left",
                          flush=True)
        if failed:
            print(f"\n{len(failed)} advisories failed:", file=sys.stderr)
            for line in failed[:5]:
                print(f"  {line}", file=sys.stderr)
            if len(failed) > len(todo) * 0.1:
                print("\nmore than a tenth failed; not writing the CSV.", file=sys.stderr)
                return 1

    if args.only:
        # A probe holds labels for a handful of advisories. Folding those back
        # would rewrite the CSV off a partial set, so stop here and report.
        for r in unique.itertuples():
            path = _cache_path(r.advisory_id, model)
            if not path.exists():
                print(f"  {r.advisory_id}  no label")
                continue
            got = json.loads(path.read_text())
            print(f"  {r.advisory_id}  {got['attack_class']}"
                  f"{' [ai-specific]' if got['ai_specific'] else ''}")
        print("\nprobe only; the CSV was not touched.")
        return 0

    # Fold the cached labels back onto every row of the advisories table.
    labels: dict[str, Result] = {}
    for r in unique.itertuples():
        path = _cache_path(r.advisory_id, model)
        if path.exists():
            try:
                labels[r.advisory_id] = Result(**json.loads(path.read_text()))
            except (json.JSONDecodeError, TypeError):
                continue
    if not labels:
        print("no labels available; CSV unchanged.", file=sys.stderr)
        return 1

    source = (f"{model} ({PROVIDERS[args.provider].label})"
              if args.provider != "keyword" else KeywordProvider.label)

    frame = pd.read_csv(config.ADVISORIES_CSV)
    def pick(advisory_id, field, fallback):
        got = labels.get(advisory_id)
        return getattr(got, field) if got else fallback

    frame["attack_class"] = [pick(i, "attack_class", c) for i, c
                             in zip(frame.advisory_id, frame.attack_class)]
    frame["ai_specific"] = [pick(i, "ai_specific", c) for i, c
                            in zip(frame.advisory_id, frame.ai_specific)]
    frame["entry_point"] = [pick(i, "entry_point", c) for i, c
                            in zip(frame.advisory_id, frame.get("entry_point", pd.NA))]
    frame["one_line_summary"] = [pick(i, "one_line_summary", c) for i, c
                                 in zip(frame.advisory_id,
                                        frame.get("one_line_summary", pd.NA))]
    frame["label_source"] = [source if i in labels else s for i, s
                             in zip(frame.advisory_id, frame.label_source)]

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = config.ADVISORIES_CSV.with_suffix(f".{stamp}.bak.csv")
    shutil.copy2(config.ADVISORIES_CSV, backup)
    frame.to_csv(config.ADVISORIES_CSV, index=False)

    covered = sum(1 for i in frame.advisory_id if i in labels)
    print(f"\nwrote      {config.ADVISORIES_CSV.name}")
    print(f"           {covered}/{len(frame)} rows carry {source}")
    print(f"backup     {backup.name}")
    print(f"\nai-specific now: {int(frame.ai_specific.astype(bool).sum())} of {len(frame)}")
    print("\nNext:  python3 -m pipeline.build && python3 -m pipeline.verify")
    print("The site reads label_source, so the 'Preliminary label' pills and the")
    print("methods page update themselves once this is no longer the keyword pass.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
