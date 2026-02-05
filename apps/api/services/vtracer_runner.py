from pathlib import Path
import subprocess
from dataclasses import dataclass


@dataclass
class VtracerOptions:
    mode: str = "color"
    colormode: str = "color"
    hierarchical: bool = False
    filter_speckle: int = 4
    color_precision: int = 6
    length_threshold: float = 4.0
    corner_threshold: float = 60.0
    segment_length: float = 4.0
    spiro: bool = True


def run_vtracer_to_svg(input_path: Path, output_path: Path, options: VtracerOptions) -> None:
    cmd = [
        "vtracer",
        "--input",
        str(input_path),
        "--output",
        str(output_path),
        "--mode",
        options.mode,
        "--colormode",
        options.colormode,
        "--filter-speckle",
        str(options.filter_speckle),
        "--color-precision",
        str(options.color_precision),
        "--length-threshold",
        str(options.length_threshold),
        "--corner-threshold",
        str(options.corner_threshold),
        "--segment-length",
        str(options.segment_length)
    ]
    if options.hierarchical:
        cmd.append("--hierarchical")
    if options.spiro:
        cmd.append("--spiro")
    subprocess.run(cmd, check=True)
