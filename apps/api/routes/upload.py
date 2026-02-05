from fastapi import APIRouter, UploadFile, File, Form
from typing import Optional

from models.schemas import UploadResponse
from services.storage import create_project, save_upload

router = APIRouter()

@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(default=None)
):
    active_project_id = project_id or create_project()
    file_id = save_upload(active_project_id, file.filename, file.file)
    return UploadResponse(project_id=active_project_id, file_id=file_id, filename=file.filename)
