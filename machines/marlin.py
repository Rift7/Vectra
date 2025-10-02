from __future__ import annotations
from typing import Iterable

import numpy as np

try:
    import vpype
except Exception:  # pragma: no cover
    vpype = None

from .models import MachineProfile


def _format_float(x: float) -> str:
    # Trim trailing zeros for compact G-code
    return ("%.4f" % x).rstrip("0").rstrip(".")


def generate_gcode(doc, profile: MachineProfile) -> str:  # type: ignore[no-untyped-def]
    if vpype is None:
        raise RuntimeError("vpype not installed")

    lines: list[str] = []
    # Units
    if profile.units == MachineProfile.Units.MM:
        lines.append("G21 ; set units to mm")
    else:
        lines.append("G20 ; set units to inches")
    lines.append("G90 ; absolute positioning")

    # Preamble
    if profile.preamble:
        lines.append(profile.preamble.strip())

    travel_f = _format_float(profile.travel_feedrate)
    draw_f = _format_float(profile.draw_feedrate)
    z_up = _format_float(profile.z_up)
    z_down = _format_float(profile.z_down)

    # Ensure pen up at start
    lines.append(f"G1 Z{z_up} F{travel_f}")

    for layer_id, lc in doc.layers.items():
        # lc is a LineCollection
        for arr in lc:
            if len(arr) == 0:
                continue
            # Move to start point
            x0 = float(np.real(arr[0]))
            y0 = float(np.imag(arr[0]))
            lines.append(f"G0 X{_format_float(x0)} Y{_format_float(y0)} F{travel_f}")
            # Pen down
            lines.append(f"G1 Z{z_down} F{travel_f}")
            # Draw segments
            for c in arr[1:]:
                x = float(np.real(c))
                y = float(np.imag(c))
                lines.append(f"G1 X{_format_float(x)} Y{_format_float(y)} F{draw_f}")
            # Pen up
            lines.append(f"G1 Z{z_up} F{travel_f}")

    # Postamble
    if profile.postamble:
        lines.append(profile.postamble.strip())

    return "\n".join(lines) + "\n"
