from __future__ import annotations
from pathlib import Path

from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from projects.models import Asset
from .runner import PipelineExecutionError, run_pipeline
from .serializers import PipelineRunRequestSerializer


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def run_pipeline_view(request):
    serializer = PipelineRunRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    asset_id = serializer.validated_data["asset_id"]
    steps = serializer.validated_data["steps"]

    asset = get_object_or_404(Asset, id=asset_id)
    # Permissions: reuse Project membership check (simple inline)
    p = asset.project
    user = request.user
    if not (p.owner_id == user.id or p.collaborators.filter(id=user.id).exists()):
        return Response({"detail": "Forbidden"}, status=403)

    try:
        result = run_pipeline(Path(asset.file.path), steps)
    except PipelineExecutionError as exc:
        return Response({"detail": str(exc)}, status=400)

    return Response({
        "steps": result.steps_executed,
        "output_svg_url": request.build_absolute_uri(
            f"/media/{result.output_svg_path.relative_to(result.output_svg_path.parents[1])}"
        ),
    })
