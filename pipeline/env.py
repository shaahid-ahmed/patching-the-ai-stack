"""Load key/value pairs from a .env file at the repository root.

Hand-rolled rather than depending on python-dotenv, because the pipeline's
only other dependencies are pandas and scipy and this is a dozen lines.

Two rules worth stating:

  * A variable already present in the real environment always wins. An
    exported MODEL_API_KEY beats the file, so a one-off override on the
    command line behaves the way anyone would expect.
  * Values are never logged. Nothing here prints a value, and callers are
    expected to report only whether a key is present.
"""
from __future__ import annotations

import os
from pathlib import Path

#: Default location, overridable with DOTENV_PATH for tests or alternate files.
DEFAULT_PATH = Path(__file__).resolve().parent.parent / ".env"

_LOADED = False


def _unquote(value: str) -> str:
    """Strip quotes and any trailing comment.

    Order matters: a quoted value may be followed by a comment, so the closing
    quote has to be found before anything is split on "#". Doing it the other
    way round leaves the quotes attached to the value.
    """
    value = value.strip()
    if value and value[0] in "\"'":
        quote = value[0]
        end = value.find(quote, 1)
        if end != -1:
            return value[1:end]          # a comment after the close is ignored
        return value[1:]                 # unterminated quote: take the rest
    # Unquoted: a " #" begins a comment, but a bare "#" inside a token does not.
    if " #" in value:
        value = value.split(" #", 1)[0]
    return value.strip()


def load(path: Path | None = None, *, override: bool = False) -> list[str]:
    """Read `path` into os.environ. Returns the names of the keys it set."""
    target = path or Path(os.environ.get("DOTENV_PATH", DEFAULT_PATH))
    if not target.exists():
        return []

    applied: list[str] = []
    for raw in target.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):].lstrip()
        if "=" not in line:
            continue
        name, _, value = line.partition("=")
        name = name.strip()
        if not name:
            continue
        value = _unquote(value)
        if not value:
            continue  # a blank placeholder is not a value
        if override or not os.environ.get(name):
            os.environ[name] = value
            applied.append(name)
    return applied


def load_once() -> list[str]:
    """Load at most once per process. Safe to call from several entry points."""
    global _LOADED
    if _LOADED:
        return []
    _LOADED = True
    return load()


def describe(*names: str) -> str:
    """Report which of `names` are set, without revealing any value."""
    return ", ".join(
        f"{n}={'set' if os.environ.get(n) else 'missing'}" for n in names
    )
