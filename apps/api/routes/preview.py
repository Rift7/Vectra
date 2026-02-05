from fastapi import APIRouter, HTTPException

from models.schemas import PreviewResponse, PreviewMeta
from services.storage import find_output_file

router = APIRouter()

def parse_gcode_frames(gcode: str):
    frames = []
    current = {"x": 0.0, "y": 0.0}
    pen_down = False
    distance = 0.0
    pen_lifts = 0

    for raw in gcode.splitlines():
        line = raw.split(";")[0].strip()
        if not line:
            continue

        parts = line.split()
        cmd = parts[0].upper()

        if cmd in ("M3", "M03"):
            if not pen_down:
                pen_down = True
        if cmd in ("M5", "M05"):
            if pen_down:
                pen_down = False
                pen_lifts += 1

        if cmd not in ("G0", "G00", "G1", "G01"):
            continue

        x = current["x"]
        y = current["y"]
        for part in parts[1:]:
            axis = part[0].upper()
            try:
                value = float(part[1:])
            except ValueError:
                continue
            if axis == "X":
                x = value
            if axis == "Y":
                y = value

        if x != current["x"] or y != current["y"]:
            dx = x - current["x"]
            dy = y - current["y"]
            distance += (dx ** 2 + dy ** 2) ** 0.5
            current = {"x": x, "y": y}
            frames.append({"type": "move", "x": x, "y": y, "pen": "down" if pen_down else "up"})

    meta = PreviewMeta(
        estimated_time_s=round(distance / 20, 1),
        distance_mm=round(distance, 2),
        pen_lifts=max(0, pen_lifts - 1)
    )
    return PreviewResponse(frames=frames, meta=meta)


@router.get("/preview/{project_id}/{gcode_id}", response_model=PreviewResponse)
def preview(project_id: str, gcode_id: str):
    output_path = find_output_file(project_id, gcode_id)
    if output_path is None:
        raise HTTPException(status_code=404, detail="G-code not found")
    gcode = output_path.read_text()
    return parse_gcode_frames(gcode)
