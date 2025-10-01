from __future__ import annotations
from typing import Any

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Asset, Project

User = get_user_model()


class UserMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username"]


class ProjectSerializer(serializers.ModelSerializer):
    owner = UserMiniSerializer(read_only=True)
    collaborators = UserMiniSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "description",
            "owner",
            "collaborators",
            "created_at",
            "updated_at",
        ]


class AssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = [
            "id",
            "project",
            "file",
            "media_type",
            "original_name",
            "size_bytes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["original_name", "size_bytes", "created_at", "updated_at"]

    def create(self, validated_data: dict[str, Any]) -> Asset:
        file = validated_data.get("file")
        if file is not None:
            validated_data["original_name"] = getattr(file, "name", "")
            validated_data["size_bytes"] = getattr(file, "size", 0) or 0
        return super().create(validated_data)
