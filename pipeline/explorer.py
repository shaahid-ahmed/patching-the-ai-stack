"""Payloads for the explorer route and the per-package detail pages.

The advisory index deliberately omits the long `description` field. Keeping it
would roughly quadruple the payload for text that is only ever read one row at
a time; descriptions ship inside the per-package files instead, which a reader
only loads when they have narrowed to a package.
"""
from __future__ import annotations

import pandas as pd

from . import config

INDEX_FIELDS = [
    "advisory_id", "cve_id", "package", "category_id", "severity",
    "cvss_score", "exploit_probability_30d", "published_date",
    "affected_versions", "first_patched_version", "fix_release_date",
    "days_fix_before_disclosure", "gap_outlier", "has_fix",
    "attack_class", "ai_specific", "summary",
]


def build_index(advisories: pd.DataFrame) -> dict:
    frame = advisories.sort_values("published_date", ascending=False)
    rows = []
    for r in frame.itertuples():
        rows.append({
            "id": r.advisory_id,
            "cve": r.cve_id if pd.notna(r.cve_id) else None,
            "package": r.package,
            "category": r.category_id,
            "severity": str(r.severity),
            "cvss": r.cvss_score,
            "epss": r.exploit_probability_30d,
            "published": r.published_date,
            "affected": r.affected_versions,
            "patched": r.first_patched_version if pd.notna(r.first_patched_version) else None,
            "fixDate": r.fix_release_date,
            "gap": r.days_fix_before_disclosure,
            "outlier": bool(r.gap_outlier),
            "hasFix": bool(r.has_fix),
            "attackClass": r.attack_class,
            "aiSpecific": bool(r.ai_specific),
            "cwe": r.weakness_list,
            "summary": r.summary,
        })

    return {
        "rows": rows,
        "facets": {
            "categories": [
                {"id": cid, "label": c["label"], "blurb": c["blurb"],
                 "count": int((advisories["category_id"] == cid).sum())}
                for cid, c in config.CATEGORIES.items()
            ],
            "packages": [
                {"name": p, "category": advisories.loc[advisories["package"] == p, "category_id"].iat[0],
                 "count": int((advisories["package"] == p).sum())}
                for p in sorted(advisories["package"].unique())
            ],
            "severities": [
                {"id": s, "count": int((advisories["severity"] == s).sum())}
                for s in config.SEVERITY_ORDER
            ],
            "attackClasses": [
                {"id": a, "count": int((advisories["attack_class"] == a).sum())}
                for a in config.ATTACK_CLASS_ORDER
                if int((advisories["attack_class"] == a).sum()) > 0
            ],
            "fixStatus": [
                {"id": "has-fix", "label": "Fix available",
                 "count": int(advisories["has_fix"].sum())},
                {"id": "no-fix", "label": "No patched version",
                 "count": int((~advisories["has_fix"]).sum())},
                {"id": "fix-after-disclosure", "label": "Warned before a fix existed",
                 "count": int((advisories["days_fix_before_disclosure"] < 0).sum())},
            ],
            "years": sorted(int(y) for y in advisories["published_year"].dropna().unique()),
        },
        "summary": {
            "rows": int(len(advisories)),
            "advisories": int(advisories["advisory_id"].nunique()),
            "medianGap": round(float(advisories["days_fix_before_disclosure"].median()), 1),
            "unpatched": int((~advisories["has_fix"]).sum()),
        },
    }


def build_package(package: str, advisories: pd.DataFrame, releases: pd.DataFrame) -> dict:
    adv = advisories[advisories["package"] == package].sort_values(
        "published_date", ascending=False
    )
    rel = releases[releases["package"] == package].sort_values("release_date")
    gaps = adv["days_fix_before_disclosure"].dropna()

    return {
        "package": package,
        "category": adv["category_id"].iat[0],
        "categoryLabel": config.CATEGORY_LABELS[adv["category_id"].iat[0]],
        "counts": {
            "advisories": int(len(adv)),
            "releases": int(len(rel)),
            "unpatched": int((~adv["has_fix"]).sum()),
            "aiSpecific": int(adv["ai_specific"].sum()),
        },
        "gap": {
            "median": round(float(gaps.median()), 1) if not gaps.empty else None,
            "n": int(len(gaps)),
            "negative": int((gaps < 0).sum()),
        },
        "severity": {
            s: int((adv["severity"] == s).sum()) for s in config.SEVERITY_ORDER
        },
        "attackClasses": [
            {"id": k, "count": int(v)} for k, v in adv["attack_class"].value_counts().items()
        ],
        "releaseTimeline": [
            {"version": r.version, "date": r.release_date,
             "yanked": bool(r.yanked), "prerelease": bool(r.is_prerelease)}
            for r in rel.itertuples()
        ],
        "firstRelease": rel["release_date"].min() if not rel.empty else None,
        "latestRelease": rel["release_date"].max() if not rel.empty else None,
        "advisories": [
            {
                "id": r.advisory_id,
                "cve": r.cve_id if pd.notna(r.cve_id) else None,
                "severity": str(r.severity),
                "cvss": r.cvss_score,
                "epss": r.exploit_probability_30d,
                "published": r.published_date,
                "affected": r.affected_versions,
                "patched": r.first_patched_version if pd.notna(r.first_patched_version) else None,
                "fixDate": r.fix_release_date,
                "gap": r.days_fix_before_disclosure,
                "outlier": bool(r.gap_outlier),
                "hasFix": bool(r.has_fix),
                "attackClass": r.attack_class,
                "aiSpecific": bool(r.ai_specific),
                "cwe": r.weakness_list,
                "summary": r.summary,
                "description": r.description,
            }
            for r in adv.itertuples()
        ],
    }
