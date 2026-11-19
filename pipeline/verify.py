"""Check the built artifacts before anyone trusts them.

Run from the repository root:

    python3 -m pipeline.verify
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from . import config

REQUIRED_FIGURE_KEYS = {
    "q1": ["quarters", "partial_quarter", "growth"],
    "q2": ["classes", "old_vs_new", "ai_specific"],
    "q3": ["summary", "box", "histogram", "by_category", "by_half_year", "points", "coverage"],
    "q4": ["packages", "test", "bootstrap", "verdict"],
    "q5": ["overall", "cells", "by_package", "by_category", "unpatched_advisories"],
}


def main() -> int:
    failures: list[str] = []
    manifest_path = config.WEB_DIR / "src" / "data" / "manifest.json"
    if not manifest_path.exists():
        print("FAIL: no manifest. Run python3 -m pipeline.build", file=sys.stderr)
        return 1

    manifest = json.loads(manifest_path.read_text())
    public = config.WEB_DIR / "public"

    def resolve(url: str) -> Path:
        return public / url.lstrip("/")

    referenced: set[Path] = set()

    def check(url: str, label: str) -> dict | list | None:
        path = resolve(url)
        referenced.add(path)
        if not path.exists():
            failures.append(f"{label}: manifest points at missing file {url}")
            return None
        return json.loads(path.read_text())

    counts = manifest["counts"]
    index = check(manifest["files"]["advisories"], "advisories")
    if index is not None:
        if len(index["rows"]) != counts["rows"]:
            failures.append(
                f"advisories: {len(index['rows'])} rows but manifest says {counts['rows']}"
            )
        ids = {r["id"] for r in index["rows"]}
        if len(ids) != counts["advisories"]:
            failures.append(
                f"advisories: {len(ids)} distinct ids but manifest says {counts['advisories']}"
            )
        if any("description" in r for r in index["rows"]):
            failures.append("advisories: index carries description text; it belongs in detail files")

    for key, required in REQUIRED_FIGURE_KEYS.items():
        payload = check(manifest["files"]["figures"][key], f"fig-{key}")
        if payload is None:
            continue
        missing = [k for k in required if k not in payload]
        if missing:
            failures.append(f"fig-{key}: missing keys {missing}")

    methods = check(manifest["files"]["methods"], "methods")
    if methods is not None and not methods.get("limitations"):
        failures.append("methods: no limitations recorded")

    detail_packages = manifest["files"]["detail"]
    if len(detail_packages) != counts["packages"]:
        failures.append(
            f"detail: {len(detail_packages)} files but {counts['packages']} packages"
        )
    total_rows = 0
    for package, url in detail_packages.items():
        payload = check(url, f"detail/{package}")
        if payload is not None:
            total_rows += len(payload["advisories"])
    if total_rows != counts["rows"]:
        failures.append(
            f"detail: advisory rows across packages total {total_rows}, expected {counts['rows']}"
        )

    orphans = sorted(
        p for p in public.glob("data/**/*.json") if p not in referenced
    )
    if orphans:
        failures.append(
            "orphan artifacts not referenced by the manifest: "
            + ", ".join(str(p.relative_to(public)) for p in orphans)
        )

    if failures:
        print(f"FAILED {len(failures)} check(s):", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        return 1

    print(f"verified {len(referenced)} artifacts")
    print(f"  {counts['rows']} advisory-package rows / {counts['advisories']} advisories")
    print(f"  {counts['packages']} packages, {counts['releases']} releases")
    print(f"  median gap {manifest['headline']['medianGap']} days, "
          f"{counts['withoutFix']} unpatched")
    print("ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
