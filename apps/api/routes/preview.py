from fastapi import APIRouter

from models.schemas import PreviewResponse, PreviewMeta

router = APIRouter()

@router.get("/preview/{toolpath_id}", response_model=PreviewResponse)
def preview(toolpath_id: str):
    # TODO: build preview frames from toolpath
    # Placeholder: a simple square path preview
    frames = [
        {"type": "move", "x": 10, "y": 10, "pen": "up"},
        {"type": "move", "x": 90, "y": 10, "pen": "down"},
        {"type": "move", "x": 90, "y": 90, "pen": "down"},
        {"type": "move", "x": 10, "y": 90, "pen": "down"},
        {"type": "move", "x": 10, "y": 10, "pen": "down"}
    ]
    meta = PreviewMeta(estimated_time_s=12.5, distance_mm=320.0, pen_lifts=1)
    return PreviewResponse(frames=frames, meta=meta)
