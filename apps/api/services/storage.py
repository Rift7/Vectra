from pathlib import Path
from uuid import uuid4
import shutil
from typing import Optional
import json

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


def save_intermediate(project_id: str, filename: str, content: str) -> str:
    file_id = uuid4().hex
    project_dir = ensure_project_dir(project_id)
    dest_path = project_dir / "intermediate" / f"{file_id}_{filename}"
    dest_path.write_text(content)
    return file_id


def save_intermediate_file(project_id: str, filename: str, source_path: Path) -> str:
    file_id = uuid4().hex
    project_dir = ensure_project_dir(project_id)
    dest_path = project_dir / "intermediate" / f"{file_id}_{filename}"
    shutil.copyfile(source_path, dest_path)
    return file_id


def save_output(project_id: str, filename: str, content: str) -> str:
    file_id = uuid4().hex
    project_dir = ensure_project_dir(project_id)
    dest_path = project_dir / "outputs" / f"{file_id}_{filename}"
    dest_path.write_text(content)
    return file_id


def find_source_file(project_id: str, file_id: str) -> Optional[Path]:
    project_dir = ensure_project_dir(project_id)
    source_dir = project_dir / "source"
    matches = list(source_dir.glob(f"{file_id}_*"))
    return matches[0] if matches else None


def find_output_file(project_id: str, file_id: str) -> Optional[Path]:
    project_dir = ensure_project_dir(project_id)
    output_dir = project_dir / "outputs"
    matches = list(output_dir.glob(f"{file_id}_*"))
    return matches[0] if matches else None


def find_intermediate_file(project_id: str, file_id: str) -> Optional[Path]:
    project_dir = ensure_project_dir(project_id)
    intermediate_dir = project_dir / "intermediate"
    matches = list(intermediate_dir.glob(f"{file_id}_*"))
    return matches[0] if matches else None


def load_presets(project_id: str) -> list:
    project_dir = ensure_project_dir(project_id)
    preset_path = project_dir / "presets.json"
    if not preset_path.exists():
        return []
    try:
        return json.loads(preset_path.read_text())
    except json.JSONDecodeError:
        return []


def save_presets(project_id: str, presets: list) -> None:
    project_dir = ensure_project_dir(project_id)
    preset_path = project_dir / "presets.json"
    preset_path.write_text(json.dumps(presets, indent=2))
