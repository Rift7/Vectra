from __future__ import annotations
import shutil
import time
from pathlib import Path

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.core.files.base import File as DjangoFile
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from projects.models import Project, Asset
from .models import Pipeline, PipelineRun
from .runner import PipelineExecutionError, run_pipeline
from .serializers import (
    PipelineRunRecordSerializer,
    PipelineSerializer,
)


class IsProjectMember(permissions.BasePermission):
    def has_object_permission(self, request, view, obj) -> bool:  # type: ignore[override]
        if isinstance(obj, Pipeline):
            p = obj.project
            return p.owner_id == request.user.id or p.collaborators.filter(id=request.user.id).exists()
        if isinstance(obj, PipelineRun):
            p = obj.pipeline.project
            return p.owner_id == request.user.id or p.collaborators.filter(id=request.user.id).exists()
        return False


class PipelineViewSet(viewsets.ModelViewSet):
    serializer_class = PipelineSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Pipeline.objects.filter(Q(project__owner=user) | Q(project__collaborators=user)).distinct()

    @action(detail=True, methods=["post"], url_path="run")
    def run(self, request, pk=None):
        pipeline = self.get_object()
        asset_id = request.data.get("asset_id")
        if not asset_id:
            return Response({"detail": "asset_id required"}, status=status.HTTP_400_BAD_REQUEST)
        asset = get_object_or_404(pipeline.project.assets, id=asset_id)

        # snapshot steps
        steps_snapshot = [
            {"type": s.type, "params": s.params, "enabled": s.enabled}
            for s in pipeline.steps.order_by("order", "id")
            if s.enabled
        ]

        run = PipelineRun.objects.create(
            pipeline=pipeline,
            asset=asset,
            started_by=request.user,
            status=PipelineRun.Status.RUNNING,
            steps_snapshot=steps_snapshot,
        )

        t0 = time.perf_counter()
        try:
            result = run_pipeline(Path(asset.file.path), steps_snapshot)
        except PipelineExecutionError as exc:
            run.status = PipelineRun.Status.FAILED
            run.error = str(exc)
            run.duration_ms = int((time.perf_counter() - t0) * 1000)
            run.save(update_fields=["status", "error", "duration_ms", "updated_at"])
            return Response({"detail": run.error}, status=400)

        run.steps_executed = result.steps_executed
        run.duration_ms = int((time.perf_counter() - t0) * 1000)
        run.status = PipelineRun.Status.SUCCEEDED
        run.save(update_fields=["steps_executed", "duration_ms", "status", "updated_at"])

        # attach SVG artifact
        from .models import RunArtifact
        with open(result.output_svg_path, "rb") as f:
            artifact = RunArtifact(run=run, kind=RunArtifact.Kind.SVG)
            artifact.file.save(result.output_svg_path.name, DjangoFile(f), save=True)

        # attach G-code artifact if present
        if result.output_gcode_path and result.output_gcode_path.exists():
            with open(result.output_gcode_path, "rb") as f:
                artifact = RunArtifact(run=run, kind=RunArtifact.Kind.GCODE)
                artifact.file.save(result.output_gcode_path.name, DjangoFile(f), save=True)

        serializer = PipelineRunRecordSerializer(run, context={"request": request})
        return Response(serializer.data)


class PipelineRunViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PipelineRunRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return PipelineRun.objects.filter(
            Q(pipeline__project__owner=user) | Q(pipeline__project__collaborators=user)
        ).order_by("-created_at")
