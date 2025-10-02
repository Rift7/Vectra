from __future__ import annotations
from rest_framework import serializers

from .models import MachineProfile, Tool


class ToolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tool
        fields = [
            "id",
            "profile",
            "name",
            "color_hex",
            "width_mm",
            "z_down_override",
            "notes",
            "created_at",
            "updated_at",
        ]


class MachineProfileSerializer(serializers.ModelSerializer):
    tools = ToolSerializer(many=True, read_only=True)

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
            "tool_change_template",
            "tools",
            "created_at",
            "updated_at",
        ]
