"""Q3: how long between a fix shipping and the advisory going public?

`days_fix_before_disclosure` is positive when the fix shipped first (users were
quietly protected before being told) and negative when the advisory landed
before any fix existed (users were told about a flaw they could not escape).

Three honesty problems are handled here rather than in the frontend:
  * the distribution is heavily skewed, so medians lead and means are reported
    alongside only so a reader can see the difference;
  * 25 rows are statistical outliers, several of them back-filled records where
    a PyPI release long predates the advisory system. They are kept and flagged,
    never silently dropped, and every summary is published twice, with and
    without them, so the reader can see that the finding does not depend on it;
  * 60 rows have no fix at all and therefore no gap. They are counted explicitly
    so that a chart of 386 points cannot be mistaken for all 454 advisories.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .. import config, stats

GAP = "days_fix_before_disclosure"


def _histogram(values: pd.Series) -> list[dict]:
    v = pd.to_numeric(values, errors="coerce").dropna()
    edges = config.GAP_BINS
    counts, _ = np.histogram(v, bins=edges)
    return [
        {
            "start": edges[i],
            "end": edges[i + 1],
            "count": int(counts[i]),
            "negative": edges[i + 1] <= 0,
        }
        for i in range(len(counts))
    ]


def build(advisories: pd.DataFrame) -> dict:
    measurable = advisories[advisories[GAP].notna()]
    inliers = measurable[~measurable["gap_outlier"]]

    by_category = []
    for cid in config.CATEGORY_ORDER:
        sub = measurable[measurable["category_id"] == cid]
        by_category.append({
            "category_id": cid,
            "label": config.CATEGORY_LABELS[cid],
            "box": stats.box_stats(sub[GAP]),
            "summary": stats.describe(sub[GAP]),
            "summary_excluding_outliers": stats.describe(
                sub.loc[~sub["gap_outlier"], GAP]
            ),
            "no_fix": int((advisories["category_id"].eq(cid) & ~advisories["has_fix"]).sum()),
        })

    by_year = []
    for year in sorted(measurable["published_year"].dropna().unique()):
        sub = measurable[measurable["published_year"] == year]
        by_year.append({
            "year": int(year),
            "box": stats.box_stats(sub[GAP]),
            "summary": stats.describe(sub[GAP]),
        })

    # Half-year medians drive the "has the gap moved?" panel. Half-years rather
    # than quarters because several quarters hold too few measurable gaps to
    # support a median anyone should read.
    half = measurable.assign(
        half=measurable["published_date"].dt.year.astype(str)
        + "H"
        + ((measurable["published_date"].dt.quarter > 2).astype(int) + 1).astype(str)
    )
    by_half_year = [
        {
            "period": period,
            "label": f"{period[:4]} H{period[-1]}",
            "box": stats.box_stats(sub[GAP]),
            "summary": stats.describe(sub[GAP]),
        }
        for period, sub in half.groupby("half")
        if len(sub) >= 5
    ]

    # Does the newest category really lag the oldest, or is that noise?
    serving = measurable.loc[measurable["category_id"] == "serving-and-web-tools", GAP]
    frameworks = measurable.loc[measurable["category_id"] == "application-frameworks", GAP]

    # Chart geometry only. Anything a tooltip needs beyond this is looked up by
    # id against the explorer index, which every route already has loaded.
    points = [
        {
            "id": r.advisory_id,
            "package": r.package,
            "category_id": r.category_id,
            "gap": round(float(getattr(r, GAP)), 2),
            "severity": str(r.severity),
            "outlier": bool(r.gap_outlier),
        }
        for r in measurable.itertuples()
    ]

    return {
        "summary": stats.describe(measurable[GAP]),
        "summary_excluding_outliers": stats.describe(inliers[GAP]),
        "box": stats.box_stats(measurable[GAP]),
        "histogram": _histogram(measurable[GAP]),
        "by_category": by_category,
        "by_year": by_year,
        "by_half_year": by_half_year,
        "points": points,
        "coverage": {
            "rows_total": int(len(advisories)),
            "gap_measurable": int(len(measurable)),
            "no_fix": int((~advisories["has_fix"]).sum()),
            "fix_version_unmatched": int(
                (advisories["has_fix"] & advisories[GAP].isna()).sum()
            ),
            "outliers": int(measurable["gap_outlier"].sum()),
        },
        "tests": {
            "serving_vs_frameworks": stats.mann_whitney(serving, frameworks),
        },
        "negative_examples": [
            {
                "id": r.advisory_id,
                "package": r.package,
                "gap": round(float(getattr(r, GAP)), 1),
                "severity": str(r.severity),
                "summary": r.summary,
            }
            for r in measurable[measurable[GAP] < 0]
            .sort_values(GAP).head(12).itertuples()
        ],
        "note": (
            "Positive means the fix shipped before the advisory was published. "
            "Negative means users were warned while no fixed version existed. "
            "An advisory's publication date is not the date the flaw was found, "
            "so this measures exposure after a fix was available, not time to fix."
        ),
    }
