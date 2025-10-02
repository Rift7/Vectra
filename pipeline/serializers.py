from __future__ import annotations
from typing import Any, Dict, List

from pydantic import ValidationError
from rest_framework import serializers

from .registry import registry


class PipelineRunSerializer(serializers.Serializer):
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
