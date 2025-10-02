from __future__ import annotations
from typing import Any, Dict, List

from pydantic import ValidationError
from rest_framework import serializers

from .models import Pipeline, PipelineRun, PipelineStepModel, RunArtifact
from .registry import registry


class PipelineRunRequestSerializer(serializers.Serializer):
    asset_id = serializers.IntegerField()
    steps = serializers.ListField(child=serializers.DictField(), allow_empty=False)

    def validate_steps(self, value: List[dict[str, Any]]):
        # validate against registry schemas
        errors: List[str] = []
        for i, step in enumerate(value):
            try:
                registry.parse(step)
            except ValidationError as ve:
                errors.append(f"step[{i}]: {ve}")
            except KeyError as ke:
                errors.append(f"step[{i}]: {ke}")
        if errors:
            raise serializers.ValidationError(errors)
        return value


class PipelineStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = PipelineStepModel
        fields = ["id", "order", "type", "params", "enabled", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at", "id"]


class PipelineSerializer(serializers.ModelSerializer):
    steps = PipelineStepSerializer(many=True)

    class Meta:
        model = Pipeline
        fields = ["id", "project", "name", "description", "steps", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def create(self, validated_data):
        steps_data = validated_data.pop("steps", [])
        pipeline = Pipeline.objects.create(**validated_data)
        for idx, step in enumerate(steps_data):
            PipelineStepModel.objects.create(pipeline=pipeline, order=step.get("order", idx), **step)
        return pipeline

    def update(self, instance: Pipeline, validated_data):
        steps_data = validated_data.pop("steps", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if steps_data is not None:
            instance.steps.all().delete()
            for idx, step in enumerate(steps_data):
                PipelineStepModel.objects.create(pipeline=instance, order=step.get("order", idx), **step)
        return instance


class RunArtifactSerializer(serializers.ModelSerializer):
    class Meta:
        model = RunArtifact
        fields = ["id", "kind", "file", "meta", "created_at"]


class PipelineRunRecordSerializer(serializers.ModelSerializer):
    artifacts = RunArtifactSerializer(many=True, read_only=True)

    class Meta:
        model = PipelineRun
        fields = [
            "id",
            "pipeline",
            "asset",
            "started_by",
            "status",
            "error",
            "steps_snapshot",
            "steps_executed",
            "duration_ms",
            "artifacts",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "error", "steps_snapshot", "steps_executed", "duration_ms", "created_at", "updated_at"]
