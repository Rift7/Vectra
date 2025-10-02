# Marlin G-code Post-Processor

Vectra can emit Marlin-style G-code from vpype Documents using a MachineProfile.

MachineProfile fields
- units: mm or inches
- origin: front-left or center (currently informational)
- bed_width, bed_height
- feedrates: travel_feedrate, draw_feedrate
- pen Z control: z_up, z_down
- preamble, postamble: injected into output

G-code strategy (simple, safe defaults)
- Absolute positioning (G90); units per profile (G20/G21)
- Raise pen (Z up), rapid/travel to start point (G0), lower pen (Z down)
- Draw with G1 at draw_feedrate
- Raise pen (Z up) after each polyline
- Includes preamble/postamble text blocks

Endpoints
- Manage profiles: /api/machine-profiles/
- Manage tools (pens): /api/tools/ (each belongs to a MachineProfile)
- Run pipelines with emit_gcode step: include {"type":"emit_gcode","params":{"machine_profile_id":<id>}}
- Map layers to tools: add a `tool_map` step before `emit_gcode`, e.g. {"type":"tool_map","params":{"mappings":[{"layer":1,"tool_id":<tool_id>}]}}

Notes
- This is a minimal implementation; future work can add servo-based control (M280), arcs (G2/G3), acceleration tuning, and firmware-specific quirks.
