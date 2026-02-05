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
    mode: str = "color"
    colormode: str = "color"
    hierarchical: bool = False
    filter_speckle: int = 4
    color_precision: int = 6
    length_threshold: float = 4.0
    corner_threshold: float = 60.0
    segment_length: float = 4.0
    spiro: bool = True


class VectorizePreset(BaseModel):
    name: str
    mode: str = "color"
    colormode: str = "color"
    hierarchical: bool = False
    filter_speckle: int = 4
    color_precision: int = 6
    length_threshold: float = 4.0
    corner_threshold: float = 60.0
    segment_length: float = 4.0
    spiro: bool = True


class VectorizePresetRequest(BaseModel):
    project_id: str
    preset: VectorizePreset


class VectorizePresetList(BaseModel):
    presets: List[VectorizePreset]


class ProcessRequest(BaseModel):
    project_id: str
    file_id: str


class OptimizeRequest(BaseModel):
    project_id: str
    svg_id: str


class ToolpathResponse(BaseModel):
    toolpath_id: str


class GcodeResponse(BaseModel):
    gcode_id: str


class GcodeRequest(BaseModel):
    project_id: str
    svg_id: str
    pen_down_cmd: str = "M3 S1000"
    pen_up_cmd: str = "M5"
    pen_dwell_s: float = 0.1
    vertical_flip: bool = True


class PreviewMeta(BaseModel):
    estimated_time_s: float
    distance_mm: float
    pen_lifts: int


class PreviewResponse(BaseModel):
    frames: List[Dict[str, Any]]
    meta: PreviewMeta


class PipelineJobRequest(BaseModel):
    project_id: str
    file_id: str
    filename: str
    mode: str = "color"
    colormode: str = "color"
    hierarchical: bool = False
    filter_speckle: int = 4
    color_precision: int = 6
    length_threshold: float = 4.0
    corner_threshold: float = 60.0
    segment_length: float = 4.0
    spiro: bool = True
    pen_down_cmd: str = "M3 S1000"
    pen_up_cmd: str = "M5"
    pen_dwell_s: float = 0.1
    vertical_flip: bool = True


class PipelineJobResult(BaseModel):
    ingest_svg_id: str | None = None
    processed_svg_id: str | None = None
    gcode_id: str | None = None
    source_kind: str | None = None


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    message: str
    result: PipelineJobResult | None = None
    error: str | None = None
