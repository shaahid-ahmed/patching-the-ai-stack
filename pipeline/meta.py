"""Provenance and limitations.

This is the payload behind /methods, and the source for the caveat pills that
appear beside any chart built on a preliminary label. It is written here rather
than typed into a React component so that the caveats cannot drift away from
the data they describe: the counts below are computed, not asserted.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

from . import config

SOURCES = [
    {
        "id": "github-advisories",
        "name": "GitHub Global Security Advisories API",
        "url": "https://docs.github.com/en/rest/security-advisories/global-advisories",
        "role": "Primary source 1: reviewed advisories for pip packages.",
        "auth": "No key required for public data (60 requests/hour); a free personal access token raises this to 5,000.",
    },
    {
        "id": "pypi-json",
        "name": "PyPI JSON API",
        "url": "https://docs.pypi.org/api/json/",
        "role": "Primary source 2: full release history per package, used to date the fix.",
        "auth": "No key required.",
    },
    {
        "id": "anthropic",
        "name": "Anthropic Claude API (Messages)",
        "url": "https://platform.claude.com/docs",
        "role": "Enrichment: reads each advisory and assigns an attack class, an AI-specific flag and a plain-language summary.",
        "auth": "Requires ANTHROPIC_API_KEY. Never called at page load; labels are precomputed.",
    },
]


def build(advisories: pd.DataFrame, releases: pd.DataFrame, label_sample) -> dict:
    label_source = (
        str(advisories["label_source"].mode().iat[0])
        if advisories["label_source"].notna().any() else "unknown"
    )
    labels_preliminary = "keyword" in label_source.lower()
    # The mode decides the headline, but a handful of rows can keep the
    # keyword label when the provider declines the advisory text, and the
    # limitation should say so rather than implying a clean sweep.
    keyword_rows = int(advisories["label_source"].fillna("")
                       .str.lower().str.contains("keyword").sum())

    gaps = advisories["days_fix_before_disclosure"]
    outliers = advisories[advisories["gap_outlier"]]

    checked = 0
    agreement = None
    if label_sample is not None and "my_attack_class" in label_sample.columns:
        filled = label_sample.dropna(subset=["my_attack_class"])
        checked = int(len(filled))
        if checked:
            agreement = round(
                float((filled["my_attack_class"] == filled["attack_class"]).mean()), 3
            )

    limitations = [
        {
            "id": "publication-not-discovery",
            "severity": "important",
            "headline": "Publication date is not discovery date.",
            "detail": (
                "An advisory's published_at is when the flaw was disclosed publicly, "
                "not when it was found or reported privately. Every gap on this site "
                "therefore measures how long a known, already-fixed flaw stayed quiet "
                "before users were told. It is not a measure of how fast maintainers fix things."
            ),
        },
        {
            "id": "ai-labels",
            "severity": "important" if labels_preliminary else "note",
            "headline": (
                "The attack-class and AI-specific labels are preliminary."
                if labels_preliminary
                else "Attack-class labels come from a language model."
            ),
            "detail": (
                f"Labels currently come from: {label_source}. A keyword fallback runs when no "
                "model provider is configured, and for any advisory the provider declines; it is "
                "cruder than the model pass, particularly for the 'other' class, which absorbs "
                "anything it cannot place. "
                + (
                    f"{keyword_rows} of {len(advisories)} rows still carry that fallback label "
                    "and are marked preliminary where they appear. "
                    if keyword_rows and not labels_preliminary
                    else ""
                )
                + (
                    f"A hand-check of {checked} advisories agrees with the automatic label "
                    f"{agreement:.0%} of the time."
                    if agreement is not None
                    else "The 30-advisory hand-check has not been completed yet, so no agreement rate is reported."
                )
            ),
        },
        {
            "id": "outliers",
            "severity": "note",
            "headline": f"{int(len(outliers))} gap values are statistical outliers and are kept, not dropped.",
            "detail": (
                "Several are back-filled records where a PyPI release long predates the "
                "advisory system, producing gaps of a year or more. Every summary on this "
                "site is published twice, with and without outliers, so a reader can check "
                "that no finding depends on them."
            ),
            "examples": [
                {"id": r.advisory_id, "package": r.package,
                 "gap": r.days_fix_before_disclosure, "summary": r.summary}
                for r in outliers.reindex(
                    outliers["days_fix_before_disclosure"].abs().sort_values(ascending=False).index
                ).head(25).itertuples()
            ],
        },
        {
            "id": "no-fix-rows",
            "severity": "note",
            "headline": f"{int((~advisories['has_fix']).sum())} rows have no patched version and so no gap.",
            "detail": (
                "'No patched version' means the advisory listed no fixed release at "
                "collection time. It is not the same as a fix existing but not being "
                "found. These rows are excluded from every gap statistic and counted "
                "separately, because dropping them silently would flatter every median here."
            ),
        },
        {
            "id": "sample-size",
            "severity": "important",
            "headline": f"{int(advisories['package'].nunique())} packages is a small sample.",
            "detail": (
                "Packages were chosen for popularity and for covering four distinct roles "
                "in an AI stack, not at random. Per-package rates rest on as few as two "
                "advisories, so shares carry Wilson intervals and correlations across "
                "packages are reported with their p-values rather than as findings."
            ),
        },
        {
            "id": "advisory-package-rows",
            "severity": "note",
            "headline": (
                f"{int(len(advisories))} rows cover {int(advisories['advisory_id'].nunique())} "
                "distinct advisories."
            ),
            "detail": (
                "One advisory can affect several packages, for instance langchain and "
                "langchain-core. Each affected package becomes its own row, so counts on "
                "this site are advisory-package pairs unless a chart says otherwise."
            ),
        },
    ]

    return {
        "generatedAt": datetime.now(timezone.utc),
        "observedThrough": advisories["published_date"].max(),
        "counts": {
            "rows": int(len(advisories)),
            "advisories": int(advisories["advisory_id"].nunique()),
            "packages": int(advisories["package"].nunique()),
            "releases": int(len(releases)),
            "withFix": int(advisories["has_fix"].sum()),
            "withoutFix": int((~advisories["has_fix"]).sum()),
            "gapMeasurable": int(gaps.notna().sum()),
            "outliers": int(advisories["gap_outlier"].sum()),
            "aiSpecific": int(advisories["ai_specific"].sum()),
            "negativeGap": int((gaps < 0).sum()),
        },
        "headline": {
            "medianGap": round(float(gaps.median()), 1),
            "meanGap": round(float(gaps.mean()), 1),
            "negativeShare": round(float((gaps < 0).mean()), 4),
            "negativeShareOfMeasurable": round(
                float((gaps < 0).sum() / gaps.notna().sum()), 4
            ),
            "unpatchedShare": round(float((~advisories["has_fix"]).mean()), 4),
        },
        "categories": [
            {"id": cid, "label": c["label"], "blurb": c["blurb"], "packages": c["packages"]}
            for cid, c in config.CATEGORIES.items()
        ],
        "labelSource": label_source,
        "labelsPreliminary": labels_preliminary,
        "labelCheck": {"checked": checked, "agreement": agreement},
        "sources": SOURCES,
        "limitations": limitations,
    }
