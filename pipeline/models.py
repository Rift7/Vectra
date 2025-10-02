from __future__ import annotations
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import models

from core.models import TimeStampedModel
from projects.models import Project, Asset


class Pipeline(TimeStampedModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="pipelines")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    def __str__(self) -> str:
        return f"{self.project.name}: {self.name}"


class PipelineStepModel(TimeStampedModel):
    pipeline = models.ForeignKey(Pipeline, on_delete=models.CASCADE, related_name="steps")
    order = models.PositiveIntegerField()
    type = models.CharField(max_length=64)
    params = models.JSONField(default=dict, blank=True)
    enabled = models.BooleanField(default=True)

    class Meta:
        ordering = ["order", "id"]
        unique_together = [("pipeline", "order")]

    def __str__(self) -> str:
        return f"{self.pipeline.name}#{self.order}:{self.type}"


class PipelineRun(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        RUNNING = "running", "Running"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"

    pipeline = models.ForeignKey(Pipeline, on_delete=models.CASCADE, related_name="runs")
    asset = models.ForeignKey(Asset, on_delete=models.PROTECT, related_name="pipeline_runs")
    started_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    error = models.TextField(blank=True)
    steps_snapshot = models.JSONField(default=list)
    steps_executed = models.JSONField(default=list)
    duration_ms = models.PositiveBigIntegerField(default=0)

    def __str__(self) -> str:
        return f"Run {self.id} [{self.status}] for {self.pipeline.name}"


class RunArtifact(TimeStampedModel):
    class Kind(models.TextChoices):
        SVG = "svg", "SVG"
        GCODE = "gcode", "G-code"
        PNG = "png", "PNG"
        LOG = "log", "Log"

    run = models.ForeignKey(PipelineRun, on_delete=models.CASCADE, related_name="artifacts")
    kind = models.CharField(max_length=16, choices=Kind.choices)
    file = models.FileField(upload_to="pipeline_runs/%Y/%m/%d")
    meta = models.JSONField(default=dict, blank=True)

    def __str__(self) -> str:
        return f"Run {self.run_id} {self.kind}"
