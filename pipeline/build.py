"""Orchestrator: CSVs in, hashed JSON artifacts plus a manifest out.

Run from the repository root:

    python3 -m pipeline.build

Every artifact filename carries a content hash, so the CDN can cache them
forever and a data refresh can never be served stale. The manifest is the one
unhashed file, and it is imported into the JavaScript bundle rather than
fetched, so a data change produces a new bundle hash and there is no window in
which the page and its data disagree.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import sys
from datetime import datetime, timezone

from . import config, explorer, load, meta, serialize
from .questions import q1_volume, q2_classes, q3_gap, q4_pace, q5_unpatched

SCHEMA_VERSION = 1
EAGER_BUDGET_BYTES = 120 * 1024  # gzipped: advisories + figures, as served


def _hashed_name(stem: str, payload) -> tuple[str, str]:
    text = json.dumps(serialize.clean(payload), ensure_ascii=False,
                      sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:8]
    return f"{stem}.{digest}.json", text


def _written_paths(files: dict) -> list[str]:
    paths = [files["advisories"], files["methods"]]
    paths += list(files["figures"].values())
    paths += list(files["detail"].values())
    return paths


def _emit(out_dir, stem: str, payload) -> tuple[str, int, int]:
    name, text = _hashed_name(stem, payload)
    path = out_dir / name
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = text.encode("utf-8")
    path.write_text(text, encoding="utf-8")
    return name, len(raw), len(gzip.compress(raw, 6))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build web data artifacts.")
    parser.add_argument("--out", default=str(config.OUT_DIR))
    args = parser.parse_args(argv)

    from pathlib import Path
    out_dir = Path(args.out)

    print(f"reading  {config.ADVISORIES_CSV.name} and {config.RELEASES_CSV.name}")
    advisories = load.load_advisories()
    releases = load.load_releases()
    label_sample = load.load_label_sample()
    print(f"         {len(advisories)} advisory-package rows, {len(releases)} releases")

    pre_existing = set(out_dir.glob("**/*.json")) if out_dir.exists() else set()
    (out_dir / "detail").mkdir(parents=True, exist_ok=True)

    figures = {
        "q1": q1_volume.build(advisories),
        "q2": q2_classes.build(advisories),
        "q3": q3_gap.build(advisories),
        "q4": q4_pace.build(advisories, releases),
        "q5": q5_unpatched.build(advisories),
    }

    files: dict[str, object] = {"figures": {}, "detail": {}}
    sizes: dict[str, int] = {}

    gz: dict[str, int] = {}

    for key, payload in figures.items():
        name, size, size_gz = _emit(out_dir, f"fig-{key}", payload)
        files["figures"][key] = f"/data/{name}"
        sizes[f"fig-{key}"], gz[f"fig-{key}"] = size, size_gz

    index = explorer.build_index(advisories)
    name, size, size_gz = _emit(out_dir, "advisories", index)
    files["advisories"] = f"/data/{name}"
    sizes["advisories"], gz["advisories"] = size, size_gz

    methods = meta.build(advisories, releases, label_sample)
    name, size, size_gz = _emit(out_dir, "methods", methods)
    files["methods"] = f"/data/{name}"
    sizes["methods"], gz["methods"] = size, size_gz

    for package in sorted(advisories["package"].unique()):
        payload = explorer.build_package(package, advisories, releases)
        name, size, size_gz = _emit(out_dir / "detail", package, payload)
        files["detail"][package] = f"/data/detail/{name}"
        sizes[f"detail/{package}"], gz[f"detail/{package}"] = size, size_gz

    eager = gz["advisories"] + sum(v for k, v in gz.items() if k.startswith("fig-"))

    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "observedThrough": serialize.clean(advisories["published_date"].max()),
        "counts": methods["counts"],
        "headline": methods["headline"],
        "labelsPreliminary": methods["labelsPreliminary"],
        "files": files,
    }

    # Artifact names are content-hashed, so an unchanged rebuild rewrites the
    # same files. When the data does change the old names are orphaned. They are
    # moved aside rather than deleted: this runs in environments where deleting
    # inside the project folder is not permitted, and a half-cleaned data
    # directory would let the site serve two generations of data at once.
    # web/.trash/ is gitignored; empty it whenever you like.
    written = {out_dir / f.lstrip("/").removeprefix("data/")
               for f in _written_paths(files)}
    orphans = sorted(pre_existing - written)
    if orphans:
        trash = config.WEB_DIR / ".trash" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        trash.mkdir(parents=True, exist_ok=True)
        for path in orphans:
            path.replace(trash / path.name)
        print(f"\n  moved {len(orphans)} superseded artifact(s) to "
              f"{trash.relative_to(config.PROJECT_DIR)}")

    manifest_path = config.WEB_DIR / "src" / "data" / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    serialize.write(manifest_path, manifest, minify=False)

    print(f"\nwrote    {len(sizes)} artifacts to {out_dir}")
    print(f"           {'raw':>9}  {'gzip':>8}")
    for key in sorted(gz, key=lambda k: -gz[k])[:8]:
        print(f"           {sizes[key]/1024:6.1f} KB  {gz[key]/1024:6.1f} KB  {key}")
    print(f"\n  eager payload (advisories + 5 figures), gzipped: {eager/1024:.1f} KB"
          f"  [budget {EAGER_BUDGET_BYTES/1024:.0f} KB]")
    largest = max((k for k in gz if k.startswith("detail/")), key=lambda k: gz[k])
    print(f"  largest per-package detail, gzipped: {gz[largest]/1024:.1f} KB ({largest})")
    print(f"  manifest: {manifest_path.relative_to(config.PROJECT_DIR)}")

    if eager > EAGER_BUDGET_BYTES:
        print("\nFAIL: eager payload over budget. Move fields into the detail files.",
              file=sys.stderr)
        return 1
    print("\nok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
