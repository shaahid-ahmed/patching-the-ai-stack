"""Q4: do libraries that release more often patch faster?

The honest answer is that it looks that way and the data cannot prove it. With
16 packages the correlation is positive but not significant, so this module
publishes the test result, its p-value and an explicit `significant: false`,
plus bootstrap resample lines for the chart to draw instead of a single
confident trend line.
"""
from __future__ import annotations

import pandas as pd

from .. import config, stats

GAP = "days_fix_before_disclosure"
WINDOW_START = pd.Timestamp("2024-01-01", tz="UTC")


def build(advisories: pd.DataFrame, releases: pd.DataFrame) -> dict:
    recent = releases[releases["release_date"] >= WINDOW_START]
    observed_through = releases["release_date"].max()
    years = max((observed_through - WINDOW_START).days / 365.25, 1e-9)

    rows = []
    for package, adv in advisories.groupby("package"):
        pkg_releases = recent[recent["package"] == package]
        gaps = adv[GAP].dropna()
        rows.append({
            "package": package,
            "category_id": adv["category_id"].iat[0],
            "releases_recent": int(len(pkg_releases)),
            "releases_per_year": round(len(pkg_releases) / years, 1),
            "releases_total": int((releases["package"] == package).sum()),
            "advisories": int(len(adv)),
            "gap_measurable": int(len(gaps)),
            "median_gap": round(float(gaps.median()), 1) if not gaps.empty else None,
            "no_fix": int((~adv["has_fix"]).sum()),
            "median_cvss": (
                round(float(adv["cvss_score"].median()), 1)
                if adv["cvss_score"].notna().any() else None
            ),
        })

    frame = pd.DataFrame(rows).sort_values("releases_per_year", ascending=False)
    test = stats.spearman(frame["releases_per_year"], frame["median_gap"])

    return {
        "packages": frame.to_dict(orient="records"),
        "window": {"start": WINDOW_START, "end": observed_through, "years": round(years, 2)},
        "test": test,
        "bootstrap": stats.bootstrap_spearman(
            frame["releases_per_year"], frame["median_gap"]
        ),
        "alpha": config.ALPHA,
        "verdict": (
            "not significant at alpha = 0.05; the sample is 16 packages"
            if test.get("p_value") is not None and not test["significant"]
            else "significant at alpha = 0.05"
        ),
        "note": (
            "Each point is one package. Release pace is releases per year since "
            "January 2024. Patch speed is that package's median gap between a "
            "fix shipping and the advisory being published. The faint lines are "
            "200 bootstrap resamples, drawn in place of a single trend line "
            "because the correlation is not statistically significant."
        ),
    }
