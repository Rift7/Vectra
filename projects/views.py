from __future__ import annotations
from typing import Iterable

from django.db.models import Q
from rest_framework import permissions, viewsets

from .models import Asset, Project
from .serializers import AssetSerializer, ProjectSerializer


class IsProjectMember(permissions.BasePermission):
    def has_object_permission(self, request, view, obj) -> bool:  # type: ignore[override]
        if isinstance(obj, Project):
            return obj.owner_id == request.user.id or obj.collaborators.filter(id=request.user.id).exists()
        if isinstance(obj, Asset):
            p = obj.project
            return p.owner_id == request.user.id or p.collaborators.filter(id=request.user.id).exists()
        return False


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self) -> Iterable[Project]:
        user = self.request.user
        return Project.objects.filter(Q(owner=user) | Q(collaborators=user)).distinct().order_by("-created_at")

    def perform_create(self, serializer: ProjectSerializer) -> None:  # type: ignore[override]
        serializer.save(owner=self.request.user)


class AssetViewSet(viewsets.ModelViewSet):
    serializer_class = AssetSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectMember]

    def get_queryset(self) -> Iterable[Asset]:
        user = self.request.user
        return (
            Asset.objects.filter(Q(project__owner=user) | Q(project__collaborators=user))
            .select_related("project")
            .order_by("-created_at")
        )
