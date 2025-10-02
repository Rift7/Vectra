from __future__ import annotations
import json
from pathlib import Path
from typing import Any, Dict

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer
from django.conf import settings
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

from projects.models import Asset
from .runner import PipelineExecutionError, run_pipeline

User = get_user_model()


def _rel_media_url(path: Path) -> str:
    try:
        return f"/media/{path.relative_to(Path(settings.MEDIA_ROOT).parent)}"
    except Exception:
        # best-effort fallback
        return f"/media/{path.name}"


@shared_task(bind=True)
def run_pipeline_via_celery(self, *, asset_id: int, steps: list[dict[str, Any]], user_id: int, group_name: str) -> dict:
    channel_layer = get_channel_layer()

    def send(evt: Dict[str, Any]) -> None:
        async_to_sync(channel_layer.group_send)(
            group_name,
            {"type": "preview.event", "payload": evt},
        )

    # Validate user and asset membership
    user = get_object_or_404(User, id=user_id)
    asset = get_object_or_404(Asset, id=asset_id)
    project = asset.project
    is_member = project.owner_id == user.id or project.collaborators.filter(id=user.id).exists()
    if not is_member:
        send({"event": "error", "message": "Forbidden"})
        return {"status": "error", "detail": "forbidden"}

    send({"event": "start", "asset_id": asset_id})

    # Wrap runner progress into channel messages
    def progress_cb(evt: Dict[str, Any]) -> None:
        send(evt)

    try:
        result = run_pipeline(Path(asset.file.path), steps, progress_cb=progress_cb)
    except PipelineExecutionError as exc:
        send({"event": "error", "message": str(exc)})
        return {"status": "error", "detail": str(exc)}
    except Exception as exc:  # pragma: no cover
        send({"event": "error", "message": f"Unexpected error: {exc}"})
        return {"status": "error", "detail": str(exc)}

    payload: Dict[str, Any] = {
        "event": "completed",
        "steps": result.steps_executed,
        "output_svg_url": _rel_media_url(result.output_svg_path),
    }
    if result.output_gcode_path:
        payload["output_gcode_url"] = _rel_media_url(result.output_gcode_path)
    send(payload)

    return {"status": "ok", **payload}
