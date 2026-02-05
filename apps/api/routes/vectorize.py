from fastapi import APIRouter, HTTPException
from pathlib import Path
from fastapi.responses import PlainTextResponse

from models.schemas import SvgResponse, VectorizeRequest
from services.storage import find_source_file, ensure_project_dir, save_intermediate_file
from services.vtracer_runner import run_vtracer_to_svg, VtracerOptions

router = APIRouter()

@router.post("/vectorize", response_model=SvgResponse)
def vectorize_raster(payload: VectorizeRequest):
    source_path = find_source_file(payload.project_id, payload.file_id)
    if source_path is None:
        raise HTTPException(status_code=404, detail="Source file not found")

    project_dir = ensure_project_dir(payload.project_id)
    output_path = project_dir / "intermediate" / f"{payload.file_id}_vectorized.svg"
    try:
        options = VtracerOptions(
            mode=payload.mode,
            colormode=payload.colormode,
            hierarchical=payload.hierarchical,
            filter_speckle=payload.filter_speckle,
            color_precision=payload.color_precision,
            length_threshold=payload.length_threshold,
            corner_threshold=payload.corner_threshold,
            segment_length=payload.segment_length,
            spiro=payload.spiro
        )
        run_vtracer_to_svg(Path(source_path), output_path, options)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"vtracer failed: {exc}") from exc

    svg_id = save_intermediate_file(payload.project_id, "vectorized.svg", output_path)
    return SvgResponse(svg_id=svg_id)


@router.get("/svg/{project_id}/{svg_id}", response_class=PlainTextResponse)
def get_svg(project_id: str, svg_id: str):
    from services.storage import find_intermediate_file
    svg_path = find_intermediate_file(project_id, svg_id)
    if svg_path is None:
        raise HTTPException(status_code=404, detail="SVG not found")
    return svg_path.read_text()
