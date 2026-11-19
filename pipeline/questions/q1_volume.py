"""Q1: are advisories per quarter rising from 2022 to 2026?

The trap in this question is the final quarter. Collection stopped partway
through 2026Q4, so a naive count shows a cliff that is an artefact of when we
ran the pipeline. The payload therefore marks the partial quarter explicitly
and reports how much of it was observed, so the chart can draw it differently
rather than letting a reader infer a collapse.
"""
from __future__ import annotations

import pandas as pd

from .. import config


def _quarter_start(quarter: str) -> pd.Timestamp:
    year, q = int(quarter[:4]), int(quarter[-1])
    return pd.Timestamp(year=year, month=3 * (q - 1) + 1, day=1, tz="UTC")


def _quarter_end(quarter: str) -> pd.Timestamp:
    return _quarter_start(quarter) + pd.offsets.QuarterEnd(0)


def build(advisories: pd.DataFrame) -> dict:
    observed_through = advisories["published_date"].max()

    quarters = sorted(advisories["published_quarter"].dropna().unique())
    quarters = [q for q in quarters if q >= config.TIMELINE_START_QUARTER]

    rows = []
    for quarter in quarters:
        sub = advisories[advisories["published_quarter"] == quarter]
        start, end = _quarter_start(quarter), _quarter_end(quarter)
        total_days = (end - start).days + 1
        observed_days = min(total_days, max(0, (observed_through - start).days + 1))
        partial = observed_days < total_days

        rows.append({
            "quarter": quarter,
            "start": start,
            "label": f"{quarter[:4]} Q{quarter[-1]}",
            "total": int(len(sub)),
            "unique_advisories": int(sub["advisory_id"].nunique()),
            "partial": partial,
            "observed_days": int(observed_days),
            "total_days": int(total_days),
            "coverage": round(observed_days / total_days, 3),
            # Projecting the partial quarter to a full-quarter rate, shown only
            # as a ghosted extension so the reader can see the shape without
            # the estimate being mistaken for an observation.
            "projected_total": (
                round(len(sub) * total_days / observed_days, 1)
                if partial and observed_days > 0 else None
            ),
            "by_category": {
                cid: int((sub["category_id"] == cid).sum())
                for cid in config.CATEGORY_ORDER
            },
            "by_severity": {
                sev: int((sub["severity"] == sev).sum())
                for sev in config.SEVERITY_ORDER
            },
            "ai_specific": int(sub["ai_specific"].sum()),
        })

    complete = [r for r in rows if not r["partial"]]
    first, last = (complete[0], complete[-1]) if len(complete) >= 2 else (None, None)

    return {
        "quarters": rows,
        "partial_quarter": next((r["quarter"] for r in rows if r["partial"]), None),
        "observed_through": observed_through,
        "categories": [
            {"id": cid, "label": c["label"], "blurb": c["blurb"]}
            for cid, c in config.CATEGORIES.items()
        ],
        "growth": {
            "from_quarter": first["quarter"] if first else None,
            "from_count": first["total"] if first else None,
            "to_quarter": last["quarter"] if last else None,
            "to_count": last["total"] if last else None,
            "multiple": (
                round(last["total"] / first["total"], 1)
                if first and first["total"] else None
            ),
        },
        "note": (
            "Counts are advisory-package rows. The final quarter is partial: "
            "collection stopped mid-quarter, so it is drawn separately and is "
            "not evidence of a decline."
        ),
    }
