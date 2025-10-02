from __future__ import annotations
from django.db import models
from core.models import TimeStampedModel


class MachineProfile(TimeStampedModel):
    class Units(models.TextChoices):
        MM = "mm", "Millimeters"
        IN = "in", "Inches"

    class Origin(models.TextChoices):
        FRONT_LEFT = "front_left", "Front-Left (0,0)"
        CENTER = "center", "Center"

    name = models.CharField(max_length=200, unique=True)
    notes = models.TextField(blank=True)

    # Bed / kinematics
    units = models.CharField(max_length=4, choices=Units.choices, default=Units.MM)
    origin = models.CharField(max_length=16, choices=Origin.choices, default=Origin.FRONT_LEFT)
    bed_width = models.FloatField(default=210.0, help_text="Bed width in units")
    bed_height = models.FloatField(default=297.0, help_text="Bed height in units")

    # Motion / speeds
    travel_feedrate = models.FloatField(default=3000.0, help_text="Travel feedrate (units/min)")
    draw_feedrate = models.FloatField(default=1500.0, help_text="Draw feedrate (units/min)")

    # Pen control (Z)
    z_up = models.FloatField(default=5.0)
    z_down = models.FloatField(default=0.0)

    # G-code templates
    preamble = models.TextField(
        default=(
            "; Vectra preamble\nG90 ; absolute positioning\nG21 ; units in mm (if applicable)\n"
        )
    )
    postamble = models.TextField(default="; Vectra postamble\nM2 ; program end\n")

    def __str__(self) -> str:
        return self.name
