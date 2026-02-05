from fastapi import APIRouter
from uuid import uuid4

from models.schemas import SvgResponse, VectorizeRequest

router = APIRouter()

@router.post("/vectorize", response_model=SvgResponse)
def vectorize_raster(payload: VectorizeRequest):
    # TODO: invoke vtracer and write SVG to intermediate storage
    return SvgResponse(svg_id=uuid4().hex)
