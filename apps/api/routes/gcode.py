from fastapi import APIRouter, HTTPException
from pathlib import Path

from models.schemas import GcodeResponse, GcodeRequest
from services.storage import (
    find_source_file,
    find_intermediate_file,
    save_output,
    ensure_project_dir,
    find_output_file
)
from services.vpype_runner import run_vpype_to_gcode, GcodeProfile

router = APIRouter()

@router.post("/gcode", response_model=GcodeResponse)
def generate_gcode(payload: GcodeRequest):
    source_path = find_intermediate_file(payload.project_id, payload.svg_id)
    if source_path is None:
        source_path = find_source_file(payload.project_id, payload.svg_id)
    if source_path is None:
        raise HTTPException(status_code=404, detail="Source SVG not found")

    project_dir = ensure_project_dir(payload.project_id)
    output_path = project_dir / "outputs" / f"{payload.svg_id}.gcode"
    try:
        profile = GcodeProfile(
            pen_down_cmd=payload.pen_down_cmd,
            pen_up_cmd=payload.pen_up_cmd,
            pen_dwell_s=payload.pen_dwell_s,
            vertical_flip=payload.vertical_flip
        )
        run_vpype_to_gcode(Path(source_path), output_path, profile)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"vpype gcode failed: {exc}") from exc

    content = output_path.read_text()
    gcode_id = save_output(payload.project_id, "plot.gcode", content)
    return GcodeResponse(gcode_id=gcode_id)


@router.get("/gcode/{project_id}/{gcode_id}")
def get_gcode(project_id: str, gcode_id: str):
    output_path = find_output_file(project_id, gcode_id)
    if output_path is None:
        raise HTTPException(status_code=404, detail="G-code not found")
    return output_path.read_text()
