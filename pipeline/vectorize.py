from __future__ import annotations
import shutil
import subprocess
from pathlib import Path
from typing import Optional


class VectorizeError(Exception):
    pass


def run_vtracer_cli(input_path: Path, output_path: Path, mode: str = "centerline", extra_args: Optional[str] = None) -> Path:
    if shutil.which("vtracer") is None:
        raise VectorizeError("vtracer CLI not found. Please install vtracer and ensure it is in PATH.")

    cmd = ["vtracer", str(input_path), str(output_path)]
    # common flags: centerline vs outline
    mode = mode.lower()
    if mode in ("centerline", "centreline"):
        cmd.append("--centerline")
    elif mode in ("outline", "contour"):
        # default is outline; no extra flag required for some versions
        pass
    else:
        raise VectorizeError(f"unsupported mode: {mode}")

    if extra_args:
        cmd.extend(extra_args.split())

    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as exc:  # pragma: no cover
        raise VectorizeError(f"vtracer failed: {exc}") from exc

    if not output_path.exists():
        raise VectorizeError("vtracer did not produce an output file")

    return output_path
