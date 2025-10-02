from __future__ import annotations
from typing import Any

from pydantic import BaseModel, Field

from .registry import StepDef, registry
from .vpype_utils import run_vpype_command

# vpype imports are handled in runner and vpype_utils; steps avoid direct vpype deps

class VectorizeParams(BaseModel):
    mode: str = Field("centerline", description="centerline|outline")
    extra_args: str | None = Field(None, description="Advanced vtracer CLI arguments")


registry.register(
    StepDef(
        type_name="vectorize",
        schema=VectorizeParams,
        runner=lambda doc, params: doc,  # handled specially in runner
        description="Vectorize a raster input (PNG/JPG) using vtracer CLI",
    )
)


class ImportParams(BaseModel):
    # For now, we import from an existing Asset path handled by the runner; params reserved for future
    layer: int = Field(1, ge=1, description="Target layer id for import")


def run_import(doc: Any, params: ImportParams) -> Any:
    if vpype is None or read_svg is None:
        raise RuntimeError("vpype is not installed. Please install 'vpype' to use pipeline steps.")
    # doc is ignored; we create a new Document from file path later in runner
    return doc


registry.register(
    StepDef(
        type_name="import",
        schema=ImportParams,
        runner=run_import,
        description="Import an SVG into a vpype Document",
    )
)


class ScaleParams(BaseModel):
    sx: float = Field(..., description="Scale factor in X")
    sy: float | None = Field(None, description="Scale factor in Y (defaults to sx)")


def run_scale(doc: Any, params: ScaleParams) -> Any:
    sy = params.sy if params.sy is not None else params.sx
    return run_vpype_command(doc, f"scale {params.sx} {sy}")


registry.register(
    StepDef(
        type_name="scale",
        schema=ScaleParams,
        runner=run_scale,
        description="Scale geometry by sx/sy",
    )
)


class SimplifyParams(BaseModel):
    tolerance: float = Field(0.2, ge=0.0, description="Douglas-Peucker tolerance in document units")


def run_simplify(doc: Any, params: SimplifyParams) -> Any:
    return run_vpype_command(doc, f"simplify {params.tolerance}")


registry.register(
    StepDef(
        type_name="simplify",
        schema=SimplifyParams,
        runner=run_simplify,
        description="Simplify paths using Douglas-Peucker",
    )
)


class LineMergeParams(BaseModel):
    enabled: bool = Field(True, description="Enable/disable linemerge step")


def run_linemerge(doc: Any, params: LineMergeParams) -> Any:
    if not params.enabled:
        return doc
    return run_vpype_command(doc, "linemerge")


registry.register(
    StepDef(
        type_name="linemerge",
        schema=LineMergeParams,
        runner=run_linemerge,
        description="Merge contiguous line segments",
    )
)


class LineSortParams(BaseModel):
    strategy: str = Field("none", description="Strategy: none|nearest|2opt|tsp")


def run_linesort(doc: Any, params: LineSortParams) -> Any:
    strat = params.strategy.lower()
    if strat in ("none", ""):
        return run_vpype_command(doc, "linesort")
    return run_vpype_command(doc, f"linesort --strategy {strat}")


registry.register(
    StepDef(
        type_name="linesort",
        schema=LineSortParams,
        runner=run_linesort,
        description="Sort lines to reduce travel (nearest, 2opt, tsp)",
    )
)
