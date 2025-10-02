from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List

from django.conf import settings

from .registry import registry
from typing import Optional

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
    output_gcode_path: Optional[Path] = None


class PipelineExecutionError(Exception):
    pass


def run_pipeline(asset_path: Path, steps: Iterable[Dict[str, Any]], progress_cb: Any | None = None) -> PipelineResult:
    if vpype is None or read_svg is None or write_svg is None:
        raise PipelineExecutionError("vpype not installed. Please `pip install vpype`. ")

    if not asset_path.exists():
        raise PipelineExecutionError(f"asset not found: {asset_path}")

    suffix = asset_path.suffix.lower()

    executed: List[str] = []

    # If raster input, require a vectorize step first to convert to SVG
    if progress_cb:
        try:
            progress_cb({"event": "status", "stage": "preprocess", "suffix": suffix})
        except Exception:
            pass

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
        if progress_cb:
            try:
                progress_cb({"event": "step", "name": "vectorize", "status": "done"})
            except Exception:
                pass
        # remove the vectorize step and continue with remaining steps
        steps_iter = (s for j, s in enumerate(steps_list) if j != vec_idx)
    else:
        steps_iter = iter(steps)

    if asset_path.suffix.lower() != ".svg":
        raise PipelineExecutionError("Unsupported input format after preprocessing.")

    # Start with document loaded from SVG
    doc = read_svg(str(asset_path))

    # Track emit_gcode params if present
    emit_params = None
    layer_tool_map: dict[int, int] = {}
    steps_collect: List[Dict[str, Any]] = []

    for step_obj in steps_iter:
        sd, params = registry.parse(step_obj)
        if sd.type_name.lower() == "import":
            executed.append(sd.type_name)
            if progress_cb:
                try:
                    progress_cb({"event": "step", "name": sd.type_name, "status": "done"})
                except Exception:
                    pass
            continue
        if sd.type_name.lower() == "emit_gcode":
            emit_params = params
            executed.append(sd.type_name)
            if progress_cb:
                try:
                    progress_cb({"event": "step", "name": sd.type_name, "status": "queued"})
                except Exception:
                    pass
            continue
        if sd.type_name.lower() == "tool_map":
            # params.mappings: list of {layer:int, tool_id:int}
            errs: list[str] = []
            new_map: dict[int, int] = {}
            for idx, m in enumerate(params.mappings):
                if not isinstance(m, dict):
                    errs.append(f"mappings[{idx}] must be an object with 'layer' and 'tool_id'")
                    continue
                if "layer" not in m or "tool_id" not in m:
                    errs.append(f"mappings[{idx}] must include 'layer' and 'tool_id'")
                    continue
                try:
                    layer = int(m["layer"])  # type: ignore[index]
                    tool_id = int(m["tool_id"])  # type: ignore[index]
                except Exception:
                    errs.append(f"mappings[{idx}] values must be integers")
                    continue
                new_map[layer] = tool_id
            if errs:
                raise PipelineExecutionError("Invalid tool_map params: " + "; ".join(errs))
            layer_tool_map.update(new_map)
            executed.append(sd.type_name)
            continue
        try:
            doc = sd.runner(doc, params)
        except Exception as exc:  # pragma: no cover
            if progress_cb:
                try:
                    progress_cb({"event": "step", "name": sd.type_name, "status": "error", "message": str(exc)})
                except Exception:
                    pass
            raise PipelineExecutionError(f"failed at step '{sd.type_name}': {exc}") from exc
        executed.append(sd.type_name)
        if progress_cb:
            try:
                progress_cb({"event": "step", "name": sd.type_name, "status": "done"})
            except Exception:
                pass

    out_dir = Path(settings.MEDIA_ROOT) / "pipeline_outputs"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"output_{asset_path.stem}.svg"
    write_svg(doc, str(out_path))
    if progress_cb:
        try:
            progress_cb({"event": "artifact", "kind": "svg", "path": str(out_path)})
        except Exception:
            pass

    gcode_path = None
    if emit_params is not None:
        # generate G-code using machine profile
        from machines.models import MachineProfile
        from machines.marlin import generate_gcode

        try:
            profile = MachineProfile.objects.get(id=emit_params.machine_profile_id)
        except MachineProfile.DoesNotExist:
            raise PipelineExecutionError("MachineProfile not found for emit_gcode step")

        # Validate tool_map tool_ids belong to the selected MachineProfile
        if layer_tool_map:
            from machines.models import Tool
            tool_ids = set(layer_tool_map.values())
            existing = set(
                Tool.objects.filter(profile=profile, id__in=tool_ids).values_list("id", flat=True)
            )
            missing = sorted(tool_ids - existing)
            if missing:
                raise PipelineExecutionError(
                    f"tool_map contains tool_ids not belonging to MachineProfile {profile.id}: {missing}"
                )

        gcode = generate_gcode(doc, profile, layer_tool_map=layer_tool_map or None)
        gcode_dir = out_dir
        fname = emit_params.filename or f"output_{asset_path.stem}.gcode"
        gcode_path = gcode_dir / fname
        gcode_path.write_text(gcode)
        if progress_cb:
            try:
                progress_cb({"event": "artifact", "kind": "gcode", "path": str(gcode_path)})
            except Exception:
                pass

    return PipelineResult(output_svg_path=out_path, steps_executed=executed, output_gcode_path=gcode_path)
