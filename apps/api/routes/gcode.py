from fastapi import APIRouter
from uuid import uuid4

from models.schemas import GcodeResponse, GcodeRequest

router = APIRouter()

@router.post("/gcode", response_model=GcodeResponse)
def generate_gcode(payload: GcodeRequest):
    # TODO: translate toolpaths into G-code
    return GcodeResponse(gcode_id=uuid4().hex)
