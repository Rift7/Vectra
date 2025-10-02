from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Type

from pydantic import BaseModel, Field, ValidationError


@dataclass
class StepDef:
    type_name: str
    schema: Type[BaseModel]
    runner: Callable[[Any, BaseModel], Any]
    description: str = ""


class StepRegistry:
    def __init__(self) -> None:
        self._steps: Dict[str, StepDef] = {}

    def register(self, step: StepDef) -> None:
        key = step.type_name.lower()
        if key in self._steps:
            raise ValueError(f"step already registered: {step.type_name}")
        self._steps[key] = step

    def get(self, type_name: str) -> StepDef:
        key = type_name.lower()
        if key not in self._steps:
            raise KeyError(f"unknown step: {type_name}")
        return self._steps[key]

    def parse(self, step_obj: Dict[str, Any]) -> tuple[StepDef, BaseModel]:
        t = step_obj.get("type")
        if not t:
            raise ValidationError.from_exception_data("Step", [
                {
                    "type": "missing",
                    "loc": ("type",),
                    "msg": "field required",
                    "input": step_obj,
                }
            ])
        sd = self.get(t)
        params = step_obj.get("params", {})
        model = sd.schema.model_validate(params)
        return sd, model

    def list(self) -> List[str]:
        return sorted(self._steps.keys())


registry = StepRegistry()
