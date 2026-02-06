from fastapi import APIRouter

from services.storage import load_project_tree, load_runs

router = APIRouter()


@router.get("/projects/{project_id}/tree")
def get_project_tree(project_id: str):
    return load_project_tree(project_id)


@router.get("/projects/{project_id}/runs")
def get_project_runs(project_id: str):
    return {"project_id": project_id, "runs": load_runs(project_id)}


@router.get("/projects/{project_id}/summary")
def get_project_summary(project_id: str):
    return {"tree": load_project_tree(project_id), "runs": load_runs(project_id)}
