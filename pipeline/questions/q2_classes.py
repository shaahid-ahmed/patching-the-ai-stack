"""Q2: which weakness classes dominate, and does the mix differ between older
machine-learning libraries and newer large-language-model frameworks?

Two framings are produced. The full four-category matrix feeds the explorer,
and a deliberately reduced Model-libraries-versus-Application-frameworks
comparison feeds the narrative, because that is the actual old-versus-new
contrast and the other two categories muddy it.
"""
from __future__ import annotations

import pandas as pd

from .. import config

OLD_GUARD = "model-libraries"
NEW_GUARD = "application-frameworks"


def _share(count: int, total: int) -> float | None:
    return round(count / total, 4) if total else None


def build(advisories: pd.DataFrame) -> dict:
    total = len(advisories)
    classes = []

    for attack_class in config.ATTACK_CLASS_ORDER:
        sub = advisories[advisories["attack_class"] == attack_class]
        if sub.empty:
            continue
        by_category = {
            cid: int((sub["category_id"] == cid).sum())
            for cid in config.CATEGORY_ORDER
        }
        classes.append({
            "attack_class": attack_class,
            "total": int(len(sub)),
            "share": _share(len(sub), total),
            "ai_specific": int(sub["ai_specific"].sum()),
            "ai_specific_share": _share(int(sub["ai_specific"].sum()), len(sub)),
            "by_category": by_category,
            "by_category_share": {
                cid: _share(n, int((advisories["category_id"] == cid).sum()))
                for cid, n in by_category.items()
            },
            "by_severity": {
                sev: int((sub["severity"] == sev).sum())
                for sev in config.SEVERITY_ORDER
            },
            "median_cvss": (
                round(float(sub["cvss_score"].median()), 1)
                if sub["cvss_score"].notna().any() else None
            ),
        })

    classes.sort(key=lambda r: r["total"], reverse=True)

    old = advisories[advisories["category_id"] == OLD_GUARD]
    new = advisories[advisories["category_id"] == NEW_GUARD]
    comparison = []
    for row in classes:
        ac = row["attack_class"]
        o, n = int((old["attack_class"] == ac).sum()), int((new["attack_class"] == ac).sum())
        comparison.append({
            "attack_class": ac,
            "old_count": o,
            "new_count": n,
            "old_share": _share(o, len(old)),
            "new_share": _share(n, len(new)),
            "difference": round((_share(n, len(new)) or 0) - (_share(o, len(old)) or 0), 4),
        })

    ai = advisories[advisories["ai_specific"]]
    return {
        "classes": classes,
        "total_rows": total,
        "old_vs_new": {
            "old": {"id": OLD_GUARD, "label": config.CATEGORY_LABELS[OLD_GUARD], "n": int(len(old))},
            "new": {"id": NEW_GUARD, "label": config.CATEGORY_LABELS[NEW_GUARD], "n": int(len(new))},
            "rows": comparison,
        },
        "ai_specific": {
            "true": int(advisories["ai_specific"].sum()),
            "false": int((~advisories["ai_specific"]).sum()),
            "share": _share(int(advisories["ai_specific"].sum()), total),
            "by_category": {
                cid: {
                    "true": int(ai["category_id"].eq(cid).sum()),
                    "total": int(advisories["category_id"].eq(cid).sum()),
                    "share": _share(
                        int(ai["category_id"].eq(cid).sum()),
                        int(advisories["category_id"].eq(cid).sum()),
                    ),
                }
                for cid in config.CATEGORY_ORDER
            },
            "top_classes": [
                {"attack_class": k, "count": int(v)}
                for k, v in ai["attack_class"].value_counts().head(5).items()
            ],
        },
        "label_source": str(advisories["label_source"].mode().iat[0])
        if advisories["label_source"].notna().any() else None,
        "note": (
            "Attack class and the AI-specific flag are assigned by a labelling "
            "step, not by the advisory itself. The current labels come from a "
            "keyword fallback and are preliminary."
        ),
    }
