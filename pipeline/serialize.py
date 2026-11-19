"""JSON-safety helpers. pandas and numpy types do not survive json.dump."""
from __future__ import annotations

import json
import math
from datetime import date, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


def clean(value: Any) -> Any:
    """Recursively convert pandas/numpy values into JSON-native ones.

    NaN and NaT become null rather than the string 'NaN', because a missing
    fix date is a real finding in this dataset and must not read as a value.
    """
    if value is None:
        return None
    if isinstance(value, (str, bool)):
        return value
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        f = float(value)
        return None if math.isnan(f) or math.isinf(f) else round(f, 4)
    if isinstance(value, (int,)):
        return value
    if isinstance(value, (pd.Timestamp, datetime)):
        return None if pd.isna(value) else value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if value is pd.NaT:
        return None
    if isinstance(value, (list, tuple, np.ndarray, pd.Series)):
        return [clean(v) for v in list(value)]
    if isinstance(value, dict):
        return {str(k): clean(v) for k, v in value.items()}
    if isinstance(value, pd.DataFrame):
        return [clean(r) for r in value.to_dict(orient="records")]
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value


def write(path: Path, payload: Any, *, minify: bool = True) -> int:
    """Write a payload and return its byte size."""
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(
        clean(payload),
        ensure_ascii=False,
        separators=(",", ":") if minify else (", ", ": "),
        indent=None if minify else 2,
    )
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))
