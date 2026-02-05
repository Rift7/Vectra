from fastapi import APIRouter, HTTPException

from models.schemas import VectorizePresetRequest, VectorizePresetList
from services.storage import load_presets, save_presets

router = APIRouter()


@router.get("/presets/vectorize/{project_id}", response_model=VectorizePresetList)
def list_vectorize_presets(project_id: str):
    presets = load_presets(project_id)
    return VectorizePresetList(presets=presets)


@router.post("/presets/vectorize", response_model=VectorizePresetList)
def save_vectorize_preset(payload: VectorizePresetRequest):
    if not payload.preset.name:
        raise HTTPException(status_code=400, detail="Preset name is required")
    presets = load_presets(payload.project_id)
    next_presets = [p for p in presets if p.get("name") != payload.preset.name]
    next_presets.append(payload.preset.model_dump())
    save_presets(payload.project_id, next_presets)
    return VectorizePresetList(presets=next_presets)
