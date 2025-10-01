from __future__ import annotations
from celery.result import AsyncResult
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .tasks import ping as ping_task


@api_view(["POST"])  # triggers a celery task
@permission_classes([IsAuthenticated])
def celery_ping(_request):
    task = ping_task.delay("pong")
    return Response({"task_id": task.id, "eager": bool(getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False))})


@api_view(["GET"])  # fetch celery result
@permission_classes([IsAuthenticated])
def celery_result(_request, task_id: str):
    res = AsyncResult(task_id)
    payload = {"task_id": task_id, "state": res.state}
    if res.ready():
        try:
            payload["result"] = res.get(timeout=0)
        except Exception as exc:  # pragma: no cover
            payload["error"] = str(exc)
    return Response(payload)
