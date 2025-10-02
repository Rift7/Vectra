from __future__ import annotations
from django.db.models import Q
from rest_framework import permissions, viewsets

from .models import MachineProfile, Tool
from .serializers import MachineProfileSerializer, ToolSerializer


class MachineProfileViewSet(viewsets.ModelViewSet):
    queryset = MachineProfile.objects.all().order_by("name")
    serializer_class = MachineProfileSerializer
    permission_classes = [permissions.IsAuthenticated]


class ToolViewSet(viewsets.ModelViewSet):
    queryset = Tool.objects.select_related("profile").all().order_by("profile__name", "name")
    serializer_class = ToolSerializer
    permission_classes = [permissions.IsAuthenticated]
