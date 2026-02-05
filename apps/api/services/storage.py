from pathlib import Path
from uuid import uuid4
import shutil

DATA_ROOT = Path("data/projects")


def ensure_project_dir(project_id: str) -> Path:
    project_dir = DATA_ROOT / project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    (project_dir / "source").mkdir(exist_ok=True)
    (project_dir / "intermediate").mkdir(exist_ok=True)
    (project_dir / "outputs").mkdir(exist_ok=True)
    return project_dir


def create_project() -> str:
    project_id = uuid4().hex
    ensure_project_dir(project_id)
    return project_id


def save_upload(project_id: str, filename: str, file_obj) -> str:
    file_id = uuid4().hex
    project_dir = ensure_project_dir(project_id)
    dest_path = project_dir / "source" / f"{file_id}_{filename}"
    with dest_path.open("wb") as f:
        shutil.copyfileobj(file_obj, f)
    return file_id
