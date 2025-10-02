from __future__ import annotations
import asyncio
import json
from pathlib import Path
from typing import Any, Dict
from uuid import uuid4

from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser
from django.shortcuts import get_object_or_404

from projects.models import Asset
from pipeline.tasks import run_pipeline_via_celery


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

        # Lightweight permission pre-check (asset exists)
        asset = await asyncio.to_thread(lambda: get_object_or_404(Asset, id=asset_id))

        # Join a unique group for this preview run
        group_name = f"preview_{user.id}_{uuid4().hex}"
        await self.channel_layer.group_add(group_name, self.channel_name)

        # Enqueue Celery task
        run_pipeline_via_celery.delay(asset_id=asset_id, steps=steps, user_id=user.id, group_name=group_name)

        await self.send_json({"event": "queued", "group": group_name})

    async def disconnect(self, code: int):
        # Leave all groups automatically handled by Channels when connection closes
        return

    async def preview_event(self, event: Dict[str, Any]):
        # Receive events from Celery task via group_send
        payload = event.get("payload", {})
        await self.send_json(payload)

    async def send_json(self, content: Dict[str, Any]):
        await self.send(text_data=json.dumps(content))
