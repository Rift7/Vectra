from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List

from django.conf import settings

from .registry import registry

try:
    import vpype
    from vpype.read import read_svg
    from vpype.write import write_svg
except Exception:  # pragma: no cover
    vpype = None
    read_svg = None
    write_svg = None


@dataclass
class PipelineResult:
    output_svg_path: Path
    steps_executed: List[str]


class PipelineExecutionError(Exception):
    pass


def run_pipeline(asset_path: Path, steps: Iterable[Dict[str, Any]]) -> PipelineResult:
    if vpype is None or read_svg is None or write_svg is None:
        raise PipelineExecutionError("vpype not installed. Please `pip install vpype`. ")

    if not asset_path.exists():
        raise PipelineExecutionError(f"asset not found: {asset_path}")

    suffix = asset_path.suffix.lower()

    executed: List[str] = []

    # If raster input, require a vectorize step first to convert to SVG
    if suffix in {".png", ".jpg", ".jpeg"}:
        # find first vectorize step
        vec_idx = None
        steps_list = list(steps)
        for i, step_obj in enumerate(steps_list):
            if str(step_obj.get("type", "")).lower() == "vectorize":
                vec_idx = i
                break
        if vec_idx is None:
            raise PipelineExecutionError("Raster input requires a 'vectorize' step as the first step.")

        from .vectorize import run_vtracer_cli, VectorizeError
        from pydantic import BaseModel
        from .registry import registry as reg

        sd, params = reg.parse(steps_list[vec_idx])
        out_dir = Path(settings.MEDIA_ROOT) / "pipeline_temp"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_svg = out_dir / f"vectorized_{asset_path.stem}.svg"
        try:
            run_vtracer_cli(asset_path, out_svg, mode=params.mode, extra_args=params.extra_args)
        except VectorizeError as exc:  # pragma: no cover
            raise PipelineExecutionError(str(exc)) from exc
        asset_path = out_svg
        executed.append("vectorize")
        # remove the vectorize step and continue with remaining steps
        steps_iter = (s for j, s in enumerate(steps_list) if j != vec_idx)
    else:
        steps_iter = iter(steps)

    if asset_path.suffix.lower() != ".svg":
        raise PipelineExecutionError("Unsupported input format after preprocessing.")

    # Start with document loaded from SVG
    doc = read_svg(str(asset_path))

    for step_obj in steps_iter:
        sd, params = registry.parse(step_obj)
        # skip 'import' since we've already created the document
        if sd.type_name.lower() == "import":
            executed.append(sd.type_name)
            continue
        try:
            doc = sd.runner(doc, params)
        except Exception as exc:  # pragma: no cover
            raise PipelineExecutionError(f"failed at step '{sd.type_name}': {exc}") from exc
        executed.append(sd.type_name)

    out_dir = Path(settings.MEDIA_ROOT) / "pipeline_outputs"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"output_{asset_path.stem}.svg"
    write_svg(doc, str(out_path))

    return PipelineResult(output_svg_path=out_path, steps_executed=executed)
