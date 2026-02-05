from threading import Thread

from fastapi import APIRouter, HTTPException

from models.schemas import JobStatusResponse, PipelineJobRequest
from services.job_manager import create_job, get_job, update_job
from services.pipeline_job import run_pipeline_job

router = APIRouter()


@router.post("/jobs", response_model=JobStatusResponse)
def start_job(payload: PipelineJobRequest):
    job_id = create_job()

    def _run():
        try:
            run_pipeline_job(job_id, payload)
        except Exception as exc:
            update_job(
                job_id,
                status="failed",
                progress=100,
                message="Pipeline failed",
                error=str(exc)
            )

    Thread(target=_run, daemon=True).start()
    job = get_job(job_id)
    return JobStatusResponse(**job)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse(**job)
