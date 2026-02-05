from fastapi import APIRouter
from uuid import uuid4

from models.schemas import SvgResponse, ProcessRequest

router = APIRouter()

@router.post("/process", response_model=SvgResponse)
def process_vector(payload: ProcessRequest):
    # TODO: invoke vpype pipeline and write SVG output
    return SvgResponse(svg_id=uuid4().hex)
