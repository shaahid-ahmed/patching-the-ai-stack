"""Read the Phase III CSVs into typed frames. The only module that touches disk input.

Every other module takes frames as arguments, which keeps the question modules
pure and testable and means a change of storage format lands in one file.
"""
from __future__ import annotations

import pandas as pd

from . import config


MISSING_INPUTS = """
The analysis CSVs this pipeline reads are not in this repository.

  expected: {paths}

They are produced by the Phase III notebook and live in the local project
folder this site was split out of, alongside the cached API responses. Copy
`phase3/` back in, or run the notebook, then try again.

You do not need them to build or deploy the site: the generated artifacts in
web/public/data/ are committed and current.
"""


def _require(*paths) -> None:
    missing = [p for p in paths if not p.exists()]
    if missing:
        raise SystemExit(
            MISSING_INPUTS.format(paths="\n            ".join(str(p) for p in missing))
        )


def _to_utc(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, utc=True, errors="coerce")


def load_advisories() -> pd.DataFrame:
    """One row per advisory-package pair (454). Not per advisory (419)."""
    _require(config.ADVISORIES_CSV)
    df = pd.read_csv(config.ADVISORIES_CSV)

    for col in ("published_date", "updated_date", "github_reviewed_date",
                "nvd_published_date", "fix_release_date"):
        if col in df.columns:
            df[col] = _to_utc(df[col])

    for col in ("has_fix", "ai_specific", "gap_outlier", "fix_release_yanked"):
        if col in df.columns:
            df[col] = df[col].astype("object").where(df[col].notna(), False).astype(bool)

    df["category_id"] = df["category"].map(config.LABEL_TO_ID)
    if df["category_id"].isna().any():
        unknown = sorted(df.loc[df["category_id"].isna(), "category"].unique())
        raise ValueError(f"advisory rows carry categories absent from config: {unknown}")

    df["severity"] = pd.Categorical(
        df["severity"], categories=config.SEVERITY_ORDER, ordered=True
    )

    # weakness_ids arrives as a comma-joined string; a list is what callers want.
    df["weakness_list"] = (
        df["weakness_ids"].fillna("").astype(str)
        .apply(lambda s: [w.strip() for w in s.split(",") if w.strip()])
    )
    return df


def load_releases() -> pd.DataFrame:
    """One row per published PyPI release (4,608)."""
    _require(config.RELEASES_CSV)
    df = pd.read_csv(config.RELEASES_CSV)
    df["release_date"] = _to_utc(df["release_date"])
    for col in ("yanked", "is_prerelease"):
        df[col] = df[col].astype("object").where(df[col].notna(), False).astype(bool)
    df["category_id"] = df["category"].map(config.LABEL_TO_ID)
    return df


def load_label_sample() -> pd.DataFrame | None:
    """The 30-advisory hand-check sample, if it has been filled in."""
    if not config.LABEL_SAMPLE_CSV.exists():
        return None
    return pd.read_csv(config.LABEL_SAMPLE_CSV)
