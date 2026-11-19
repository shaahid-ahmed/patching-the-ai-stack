"""Q5: what share of advisories have no patched version, and where do they sit?

Proportions here sit on small denominators -- several packages carry fewer than
fifteen advisories -- so every share ships with a Wilson score interval, and the
frontend is expected to show the interval rather than rank bare percentages.
"""
from __future__ import annotations

import pandas as pd

from .. import config, stats


def build(advisories: pd.DataFrame) -> dict:
    unpatched = advisories[~advisories["has_fix"]]

    by_package = []
    for package, sub in advisories.groupby("package"):
        n_unpatched = int((~sub["has_fix"]).sum())
        by_package.append({
            "package": package,
            "category_id": sub["category_id"].iat[0],
            "total": int(len(sub)),
            "unpatched": n_unpatched,
            **stats.wilson_interval(n_unpatched, len(sub)),
            "unpatched_critical": int(
                ((~sub["has_fix"]) & sub["severity"].isin(["critical", "high"])).sum()
            ),
        })
    by_package.sort(key=lambda r: (-r["unpatched"], -r["total"]))

    by_category = []
    for cid in config.CATEGORY_ORDER:
        sub = advisories[advisories["category_id"] == cid]
        n_unpatched = int((~sub["has_fix"]).sum())
        by_category.append({
            "category_id": cid,
            "label": config.CATEGORY_LABELS[cid],
            "total": int(len(sub)),
            "unpatched": n_unpatched,
            **stats.wilson_interval(n_unpatched, len(sub)),
        })

    by_severity = []
    for sev in config.SEVERITY_ORDER:
        sub = advisories[advisories["severity"] == sev]
        n_unpatched = int((~sub["has_fix"]).sum())
        by_severity.append({
            "severity": sev,
            "total": int(len(sub)),
            "unpatched": n_unpatched,
            **stats.wilson_interval(n_unpatched, len(sub)),
        })

    return {
        "overall": {
            "total": int(len(advisories)),
            "unpatched": int(len(unpatched)),
            **stats.wilson_interval(len(unpatched), len(advisories)),
        },
        # One cell per advisory-package row, for the waffle. Ordered by category
        # then severity so the marked cells cluster meaningfully.
        "cells": [
            {
                "id": r.advisory_id,
                "package": r.package,
                "category_id": r.category_id,
                "severity": str(r.severity),
                "unpatched": not bool(r.has_fix),
            }
            for r in advisories.sort_values(
                ["category_id", "severity", "package"]
            ).itertuples()
        ],
        "by_package": by_package,
        "by_category": by_category,
        "by_severity": by_severity,
        "unpatched_advisories": [
            {
                "id": r.advisory_id,
                "cve": r.cve_id if pd.notna(r.cve_id) else None,
                "package": r.package,
                "category_id": r.category_id,
                "severity": str(r.severity),
                "cvss": r.cvss_score,
                "exploit_probability_30d": r.exploit_probability_30d,
                "published": r.published_date,
                "affected_versions": r.affected_versions,
                "attack_class": r.attack_class,
            }
            for r in unpatched.sort_values("published_date", ascending=False).itertuples()
        ],
        "note": (
            "No patched version recorded means the advisory lists no fixed "
            "release as of collection. Shares carry Wilson 95% intervals "
            "because several packages have few advisories."
        ),
    }
