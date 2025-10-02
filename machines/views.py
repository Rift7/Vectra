from __future__ import annotations
from django.db.models import Q
from rest_framework import permissions, viewsets

from .models import MachineProfile
from .serializers import MachineProfileSerializer


class MachineProfileViewSet(viewsets.ModelViewSet):
    queryset = MachineProfile.objects.all().order_by("name")
    serializer_class = MachineProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
