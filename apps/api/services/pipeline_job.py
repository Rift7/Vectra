from pathlib import Path

from models.schemas import PipelineJobRequest
from services.ingestion import ingest_to_svg_stub
from services.job_manager import update_job
from services.storage import (
    append_run,
    ensure_project_dir,
    find_intermediate_file,
    find_source_file,
    save_intermediate,
    save_output
)
from services.vpype_runner import GcodeProfile, run_vpype_to_gcode, run_vpype_to_svg
from services.vtracer_runner import VtracerOptions, run_vtracer_to_svg


def _resolve_svg_path(project_id: str, svg_id: str):
    path = find_intermediate_file(project_id, svg_id)
    if path is None:
        path = find_source_file(project_id, svg_id)
    return path


def run_pipeline_job(job_id: str, payload: PipelineJobRequest) -> None:
    update_job(job_id, status="running", progress=5, message="Starting job")
    project_dir = ensure_project_dir(payload.project_id)

    ingest_svg_id, source_kind = ingest_to_svg_stub(payload.project_id, payload.file_id, payload.filename)
    update_job(
        job_id,
        progress=20,
        message=f"Ingestion complete ({source_kind})",
        result={"ingest_svg_id": ingest_svg_id, "source_kind": source_kind}
    )

    working_svg_id = ingest_svg_id
    if source_kind == "raster":
        update_job(job_id, progress=30, message="Vectorizing raster")
        source_path = find_source_file(payload.project_id, payload.file_id)
        if source_path is None:
            raise RuntimeError("Source raster not found")
        vectorized_path = project_dir / "intermediate" / f"{payload.file_id}_vectorized.svg"
        v_opts = VtracerOptions(
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
        run_vtracer_to_svg(Path(source_path), vectorized_path, v_opts)
        working_svg_id = save_intermediate(payload.project_id, "vectorized.svg", vectorized_path.read_text())
        update_job(job_id, progress=45, message="Vectorization complete", result={"ingest_svg_id": working_svg_id})

    update_job(job_id, progress=55, message="Running vpype processing")
    source_svg_path = _resolve_svg_path(payload.project_id, working_svg_id)
    if source_svg_path is None:
        raise RuntimeError("SVG input for processing not found")
    processed_path = project_dir / "intermediate" / f"{working_svg_id}_processed.svg"
    run_vpype_to_svg(Path(source_svg_path), processed_path)
    processed_svg_id = save_intermediate(payload.project_id, "processed.svg", processed_path.read_text())
    update_job(job_id, progress=75, message="Processing complete", result={"processed_svg_id": processed_svg_id})

    update_job(job_id, progress=82, message="Generating G-code")
    processed_svg_path = _resolve_svg_path(payload.project_id, processed_svg_id)
    if processed_svg_path is None:
        raise RuntimeError("Processed SVG not found")
    gcode_path = project_dir / "outputs" / f"{processed_svg_id}.gcode"
    g_profile = GcodeProfile(
        pen_down_cmd=payload.pen_down_cmd,
        pen_up_cmd=payload.pen_up_cmd,
        pen_dwell_s=payload.pen_dwell_s,
        vertical_flip=payload.vertical_flip
    )
    run_vpype_to_gcode(Path(processed_svg_path), gcode_path, g_profile)
    gcode_id = save_output(payload.project_id, "plot.gcode", gcode_path.read_text())
    append_run(
        payload.project_id,
        {
            "job_id": job_id,
            "source_kind": source_kind,
            "source_file_id": payload.file_id,
            "ingest_svg_id": working_svg_id,
            "processed_svg_id": processed_svg_id,
            "gcode_id": gcode_id,
            "status": "completed"
        }
    )

    update_job(
        job_id,
        status="completed",
        progress=100,
        message="Pipeline completed",
        result={"gcode_id": gcode_id}
    )
