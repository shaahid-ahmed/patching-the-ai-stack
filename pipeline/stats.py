"""Shared statistical helpers.

Kept separate from the question modules so that every question computes its
intervals and summaries the same way, and so the frontend never has to do
statistics in JavaScript.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats as sps


def describe(values: pd.Series) -> dict:
    """Five-number summary plus the moments, for a skewed distribution.

    Reports median first because this project's headline measure is skewed
    enough that the mean misleads; the mean is included so a reader can see
    the gap between them rather than having to take our word for it.
    """
    v = pd.to_numeric(values, errors="coerce").dropna()
    if v.empty:
        return {"n": 0}
    return {
        "n": int(v.size),
        "median": float(v.median()),
        "mean": float(v.mean()),
        "sd": float(v.std(ddof=1)) if v.size > 1 else None,
        "min": float(v.min()),
        "q1": float(v.quantile(0.25)),
        "q3": float(v.quantile(0.75)),
        "max": float(v.max()),
        "negative": int((v < 0).sum()),
        "negative_share": float((v < 0).mean()),
    }


def box_stats(values: pd.Series) -> dict:
    """Tukey box-and-whisker values, with outliers listed rather than dropped."""
    v = pd.to_numeric(values, errors="coerce").dropna()
    if v.empty:
        return {"n": 0}
    q1, med, q3 = (float(v.quantile(q)) for q in (0.25, 0.5, 0.75))
    iqr = q3 - q1
    lo_fence, hi_fence = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    inliers = v[(v >= lo_fence) & (v <= hi_fence)]
    return {
        "n": int(v.size),
        "q1": q1,
        "median": med,
        "q3": q3,
        "iqr": float(iqr),
        "whisker_low": float(inliers.min()) if not inliers.empty else q1,
        "whisker_high": float(inliers.max()) if not inliers.empty else q3,
        "outliers": sorted(float(x) for x in v[(v < lo_fence) | (v > hi_fence)]),
    }


def wilson_interval(successes: int, total: int, z: float = 1.96) -> dict:
    """Wilson score interval for a proportion.

    Used instead of the normal approximation because several packages carry
    only a handful of advisories, where the naive interval runs past 0 or 1.
    """
    if total == 0:
        return {"estimate": None, "low": None, "high": None, "n": 0}
    p = successes / total
    denom = 1 + z**2 / total
    centre = (p + z**2 / (2 * total)) / denom
    margin = z * np.sqrt(p * (1 - p) / total + z**2 / (4 * total**2)) / denom
    return {
        "estimate": float(p),
        "low": float(max(0.0, centre - margin)),
        "high": float(min(1.0, centre + margin)),
        "n": int(total),
    }


def spearman(x: pd.Series, y: pd.Series) -> dict:
    """Spearman rank correlation with its p-value and an explicit verdict."""
    pair = pd.DataFrame({"x": x, "y": y}).dropna()
    if len(pair) < 3:
        return {"n": len(pair), "rho": None, "p_value": None, "significant": False}
    rho, p = sps.spearmanr(pair["x"], pair["y"])
    return {
        "n": int(len(pair)),
        "rho": float(rho),
        "p_value": float(p),
        "significant": bool(p < 0.05),
    }


def bootstrap_spearman(
    x: pd.Series, y: pd.Series, n_resamples: int = 200, seed: int = 20261119
) -> list[dict]:
    """Resample pairs with replacement and refit, returning each fit's line.

    The point of drawing these faintly behind a scatter is to let a reader see
    how unstable the relationship is at this sample size, instead of showing a
    single confident trend line for a correlation that is not significant.
    """
    pair = pd.DataFrame({"x": x, "y": y}).dropna()
    if len(pair) < 4:
        return []
    rng = np.random.default_rng(seed)
    xs, ys = pair["x"].to_numpy(float), pair["y"].to_numpy(float)
    x_lo, x_hi = float(xs.min()), float(xs.max())
    lines: list[dict] = []
    for _ in range(n_resamples):
        idx = rng.integers(0, len(xs), len(xs))
        bx, by = xs[idx], ys[idx]
        if np.ptp(bx) == 0:
            continue
        slope, intercept = np.polyfit(bx, by, 1)
        lines.append({
            "x1": x_lo, "y1": float(slope * x_lo + intercept),
            "x2": x_hi, "y2": float(slope * x_hi + intercept),
        })
    return lines


def mann_whitney(a: pd.Series, b: pd.Series) -> dict:
    """Two-sided Mann-Whitney U, the right test for these skewed samples."""
    av = pd.to_numeric(a, errors="coerce").dropna()
    bv = pd.to_numeric(b, errors="coerce").dropna()
    if av.empty or bv.empty:
        return {"n_a": int(av.size), "n_b": int(bv.size), "p_value": None, "significant": False}
    u, p = sps.mannwhitneyu(av, bv, alternative="two-sided")
    return {
        "n_a": int(av.size),
        "n_b": int(bv.size),
        "median_a": float(av.median()),
        "median_b": float(bv.median()),
        "u": float(u),
        "p_value": float(p),
        "significant": bool(p < 0.05),
    }
