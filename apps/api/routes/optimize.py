from fastapi import APIRouter
from uuid import uuid4

from models.schemas import ToolpathResponse, OptimizeRequest

router = APIRouter()

@router.post("/optimize", response_model=ToolpathResponse)
def optimize_toolpaths(payload: OptimizeRequest):
    # TODO: run toolpath ordering and pen-lift optimization
    return ToolpathResponse(toolpath_id=uuid4().hex)
