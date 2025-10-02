from __future__ import annotations
import asyncio
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.shortcuts import get_object_or_404

from projects.models import Asset
from pipeline.runner import PipelineExecutionError, run_pipeline


class PreviewConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or isinstance(user, AnonymousUser) or not user.is_authenticated:
            await self.close(code=4401)  # unauthorized
            return
        await self.accept()
        await self.send_json({"event": "connected"})

    async def receive(self, text_data: str | bytes | None = None, bytes_data: bytes | None = None):
        try:
            payload = json.loads(text_data or "{}")
        except json.JSONDecodeError:
            await self.send_json({"event": "error", "message": "Invalid JSON"})
            return

        action = payload.get("action")
        if action != "run":
            await self.send_json({"event": "error", "message": "Unsupported action"})
            return

        asset_id = payload.get("asset_id")
        steps = payload.get("steps") or []
        if not isinstance(asset_id, int) or not isinstance(steps, list) or not steps:
            await self.send_json({"event": "error", "message": "asset_id:int and steps:list required"})
            return

        user = self.scope["user"]

        # Look up asset and basic permission: owner or collaborator
        asset = await asyncio.to_thread(lambda: get_object_or_404(Asset, id=asset_id))
        project = asset.project
        is_member = await asyncio.to_thread(
            lambda: project.owner_id == user.id or project.collaborators.filter(id=user.id).exists()
        )
        if not is_member:
            await self.send_json({"event": "error", "message": "Forbidden"})
            return

        await self.send_json({"event": "start", "asset_id": asset_id})

        def progress_cb(evt: Dict[str, Any]) -> None:
            # Fire-and-forget send; schedule on loop
            asyncio.get_running_loop().create_task(self.send_json(evt))

        try:
            result = await asyncio.to_thread(
                lambda: run_pipeline(Path(asset.file.path), steps, progress_cb=progress_cb)
            )
        except PipelineExecutionError as exc:
            await self.send_json({"event": "error", "message": str(exc)})
            return

        # Build URLs (relative)
        svg_rel = f"/media/{result.output_svg_path.relative_to(result.output_svg_path.parents[1])}"
        data: Dict[str, Any] = {
            "event": "completed",
            "steps": result.steps_executed,
            "output_svg_url": svg_rel,
        }
        if result.output_gcode_path:
            data["output_gcode_url"] = f"/media/{result.output_gcode_path.relative_to(result.output_gcode_path.parents[1])}"
        await self.send_json(data)

    async def disconnect(self, code: int):
        # Nothing specific for now
        return

    async def send_json(self, content: Dict[str, Any]):
        await self.send(text_data=json.dumps(content))
