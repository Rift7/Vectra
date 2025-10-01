from __future__ import annotations
from celery import shared_task


@shared_task
def ping(value: str = "pong") -> str:
    return value
