"""Single source of truth for paths, package taxonomy and analysis constants.

Nothing else in the pipeline hardcodes a package name, a category label or a
threshold. If a new package joins the study, it joins here and nowhere else.
"""
from __future__ import annotations

from pathlib import Path

# --- paths -----------------------------------------------------------------
PIPELINE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = PIPELINE_DIR.parent
WEB_DIR = PROJECT_DIR / "web"

PHASE3_DIR = PROJECT_DIR / "phase3"
ADVISORIES_CSV = PHASE3_DIR / "advisories_with_fix_dates_and_labels.csv"
RELEASES_CSV = PHASE3_DIR / "pypi_releases.csv"
LABEL_SAMPLE_CSV = PHASE3_DIR / "label_check_sample.csv"

OUT_DIR = WEB_DIR / "public" / "data"

# --- taxonomy --------------------------------------------------------------
# Category id -> (display label, ordered package list). The id is URL-safe and
# is what the frontend routes and filters on; the label is what a reader sees.
CATEGORIES: dict[str, dict] = {
    "model-libraries": {
        "label": "Model libraries",
        "blurb": "Load, train and run the models themselves.",
        "packages": ["transformers", "torch", "keras", "diffusers"],
    },
    "application-frameworks": {
        "label": "Application frameworks",
        "blurb": "Glue models into applications: chains, agents, retrieval.",
        "packages": [
            "langchain",
            "langchain-core",
            "langchain-community",
            "llama-index",
            "llama-index-core",
            "litellm",
        ],
    },
    "serving-and-web-tools": {
        "label": "Serving and web tools",
        "blurb": "Expose models over a network: inference servers, UIs, tracking.",
        "packages": ["vllm", "gradio", "mlflow", "ray", "bentoml"],
    },
    "agent-tools": {
        "label": "Agent tools",
        "blurb": "Connect agents to outside tools and data.",
        "packages": ["mcp"],
    },
}

CATEGORY_ORDER = list(CATEGORIES.keys())
CATEGORY_LABELS = {cid: c["label"] for cid, c in CATEGORIES.items()}
LABEL_TO_ID = {c["label"]: cid for cid, c in CATEGORIES.items()}

SEVERITY_ORDER = ["low", "medium", "high", "critical"]

# Attack classes, ordered most to least severe-sounding is NOT the order we use;
# the frontend sorts by count. This list exists so a class that drops to zero
# under a filter still has a stable slot and colour.
ATTACK_CLASS_ORDER = [
    "unsafe model or file loading",
    "prompt injection or unsafe model output",
    "code, command or query injection",
    "path traversal or file access",
    "server-side request forgery",
    "authentication or authorization",
    "information disclosure",
    "web flaw (scripting, request forgery, redirects)",
    "denial of service",
    "other",
]

# --- analysis constants ----------------------------------------------------
# Advisories before this are too sparse to chart as a quarterly series.
TIMELINE_START_QUARTER = "2023Q1"

# Histogram bin edges for the fix-to-disclosure gap, in days. Deliberately
# uneven: the interesting detail is packed around zero, and the tails are long.
GAP_BINS = [-480, -180, -90, -30, -7, 0, 7, 30, 90, 180, 360, 840]

ALPHA = 0.05  # significance threshold, stated so the frontend can cite it
