from fastapi import APIRouter, HTTPException
from pathlib import Path

from models.schemas import SvgResponse, ProcessRequest
from services.storage import find_source_file, save_intermediate, ensure_project_dir
from services.vpype_runner import run_vpype_to_svg

router = APIRouter()

@router.post("/process", response_model=SvgResponse)
def process_vector(payload: ProcessRequest):
    source_path = find_source_file(payload.project_id, payload.file_id)
    if source_path is None:
        raise HTTPException(status_code=404, detail="Source file not found")

    project_dir = ensure_project_dir(payload.project_id)
    output_path = project_dir / "intermediate" / f"{payload.file_id}_processed.svg"
    try:
        run_vpype_to_svg(Path(source_path), output_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"vpype failed: {exc}") from exc

    content = output_path.read_text()
    svg_id = save_intermediate(payload.project_id, "processed.svg", content)
    return SvgResponse(svg_id=svg_id)
