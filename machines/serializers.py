from __future__ import annotations
from rest_framework import serializers

from .models import MachineProfile


class MachineProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = MachineProfile
        fields = [
            "id",
            "name",
            "notes",
            "units",
            "origin",
            "bed_width",
            "bed_height",
            "travel_feedrate",
            "draw_feedrate",
            "z_up",
            "z_down",
            "preamble",
            "postamble",
            "created_at",
            "updated_at",
        ]
