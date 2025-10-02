# Raster-to-Vector via vtracer

Vectra integrates vtracer (CLI) to convert PNG/JPG to SVG before vpype processing.

Install vtracer
- Follow the official instructions: https://github.com/visioncortex/vtracer
- Ensure `vtracer` is in your PATH (e.g., `vtracer --help` works)

Usage in the Pipeline API
- For PNG/JPG assets, include a first step of type `vectorize`:
```
{
  "asset_id": <id_of_png_or_jpg_asset>,
  "steps": [
    {"type": "vectorize", "params": {"mode": "centerline"}},
    {"type": "simplify", "params": {"tolerance": 0.3}},
    {"type": "linemerge", "params": {"enabled": true}},
    {"type": "linesort", "params": {"strategy": "nearest"}}
  ]
}
```

Parameters
- mode: centerline (default) or outline
- extra_args: advanced CLI flags passed as a string (optional)

Outputs
- Temporary SVG placed under `MEDIA_ROOT/pipeline_temp/`
- Final output under `MEDIA_ROOT/pipeline_outputs/`
