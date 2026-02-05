from __future__ import annotations

from threading import Lock
from uuid import uuid4
from typing import Any


_jobs: dict[str, dict[str, Any]] = {}
_lock = Lock()


def create_job() -> str:
    job_id = uuid4().hex
    with _lock:
        _jobs[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "progress": 0,
            "message": "Queued",
            "result": None,
            "error": None
        }
    return job_id


def update_job(
    job_id: str,
    *,
    status: str | None = None,
    progress: int | None = None,
    message: str | None = None,
    result: dict[str, Any] | None = None,
    error: str | None = None
) -> None:
    with _lock:
        if job_id not in _jobs:
            return
        job = _jobs[job_id]
        if status is not None:
            job["status"] = status
        if progress is not None:
            job["progress"] = max(0, min(100, progress))
        if message is not None:
            job["message"] = message
        if result is not None:
            current = job.get("result") or {}
            current.update(result)
            job["result"] = current
        if error is not None:
            job["error"] = error


def get_job(job_id: str) -> dict[str, Any] | None:
    with _lock:
        job = _jobs.get(job_id)
        if job is None:
            return None
        return dict(job)
