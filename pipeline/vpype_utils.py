from __future__ import annotations
from typing import Any

try:
    from vpype_cli import execute
except Exception:  # pragma: no cover
    execute = None  # type: ignore


def run_vpype_command(doc: Any, command: str) -> Any:
    if execute is None:
        raise RuntimeError("vpype_cli.execute not available. Ensure 'vpype' is installed.")
    # command is a single-stage string, e.g., 'scale 0.5 0.5' or 'simplify 0.2'
    # We call execute with a minimal pipeline
    return execute(command, doc)
