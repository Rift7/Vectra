from pydantic import BaseModel
from typing import List, Dict, Any


class UploadResponse(BaseModel):
    project_id: str
    file_id: str
    filename: str


class SvgResponse(BaseModel):
    svg_id: str


class VectorizeRequest(BaseModel):
    project_id: str
    file_id: str


class ProcessRequest(BaseModel):
    project_id: str
    svg_id: str


class OptimizeRequest(BaseModel):
    project_id: str
    svg_id: str


class ToolpathResponse(BaseModel):
    toolpath_id: str


class GcodeResponse(BaseModel):
    gcode_id: str


class GcodeRequest(BaseModel):
    project_id: str
    toolpath_id: str


class PreviewMeta(BaseModel):
    estimated_time_s: float
    distance_mm: float
    pen_lifts: int


class PreviewResponse(BaseModel):
    frames: List[Dict[str, Any]]
    meta: PreviewMeta
