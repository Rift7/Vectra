from pathlib import Path
import subprocess
from dataclasses import dataclass


@dataclass
class GcodeProfile:
    pen_down_cmd: str = "M3 S1000"
    pen_up_cmd: str = "M5"
    pen_dwell_s: float = 0.1
    vertical_flip: bool = True


def write_profile_config(path: Path, profile: GcodeProfile) -> None:
    path.write_text(
        "[gwrite.vectra_plotter]\n"
        "unit = \"mm\"\n"
        "document_start = \"\"\"G21\nG90\n\"\"\"\n"
        "layer_start = \"(Start Layer)\\n\"\n"
        "line_start = \"(Start Line)\\n\"\n"
        f"segment_first = \"\"\"G00 X{{x:.3f}} Y{{y:.3f}}\n"
        f"{profile.pen_down_cmd}\n"
        f"G4 P{profile.pen_dwell_s}\n"
        "\"\"\"\n"
        "segment = \"G01 X{x:.3f} Y{y:.3f}\\n\"\n"
        f"line_end = \"\"\"{profile.pen_up_cmd}\n"
        f"G4 P{profile.pen_dwell_s}\n"
        "\"\"\"\n"
        "document_end = \"M5\\nG00 X0 Y0\\n\"\n"
        f"vertical_flip = {str(profile.vertical_flip).lower()}\n"
    )


def run_vpype_to_svg(input_path: Path, output_path: Path) -> None:
    cmd = [
        "vpype",
        "read",
        str(input_path),
        "write",
        str(output_path)
    ]
    subprocess.run(cmd, check=True)


def run_vpype_to_gcode(input_path: Path, output_path: Path, profile: GcodeProfile) -> None:
    config_path = output_path.parent / "vpype.toml"
    write_profile_config(config_path, profile)
    cmd = [
        "vpype",
        "--config",
        str(config_path),
        "read",
        str(input_path),
        "gwrite",
        "--profile",
        "vectra_plotter",
        str(output_path)
    ]
    subprocess.run(cmd, check=True)
