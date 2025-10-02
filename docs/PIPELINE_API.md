# Pipeline API (Milestone 2 skeleton)

POST /api/pipeline/run/

Request body (JSON):
```
{
  "asset_id": 1,
  "steps": [
    {"type": "import", "params": {"layer": 1}},
    {"type": "scale", "params": {"sx": 0.5}},
    {"type": "simplify", "params": {"tolerance": 0.2}},
    {"type": "linemerge", "params": {"enabled": true}},
    {"type": "linesort", "params": {"strategy": "nearest"}}
  ]
}
```

Notes
- SVG input works out of the box. For PNG/JPG input, include a first step of type `vectorize` which uses the vtracer CLI to create an SVG before subsequent steps.
- Steps are validated against Pydantic schemas via a step registry.
- The output SVG is written under MEDIA_ROOT/pipeline_outputs/ and the response returns a fully-qualified URL.
- Requires authentication and project membership for the given asset.

Error cases
- 400 if vpype is not installed or if an unsupported file type is provided.
- 403 if the user does not have access to the asset's project.
- 404 if asset_id is invalid.
