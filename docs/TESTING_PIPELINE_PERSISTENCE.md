# Testing Pipeline Persistence and Run History

Prereqs
- Complete Milestone 1 setup (see docs/TESTING_MILESTONE_1.md)
- Migrations: `python manage.py migrate`
- Logged in via browsable API or using BasicAuth

1) Create a Pipeline
POST /api/pipelines/
```
{
  "project": <project_id>,
  "name": "My First Pipeline",
  "description": "SVG prep",
  "steps": [
    {"order": 0, "type": "import", "params": {"layer": 1}, "enabled": true},
    {"order": 1, "type": "scale", "params": {"sx": 0.5}, "enabled": true},
    {"order": 2, "type": "simplify", "params": {"tolerance": 0.2}, "enabled": true},
    {"order": 3, "type": "linemerge", "params": {"enabled": true}, "enabled": true},
    {"order": 4, "type": "linesort", "params": {"strategy": "nearest"}, "enabled": true}
  ]
}
```
Expect 201 Created with pipeline id and steps.

2) Run the Pipeline on an Asset
POST /api/pipelines/{id}/run/
```
{ "asset_id": <svg_asset_id> }
```
Expect: run record with status="succeeded", steps_executed, duration_ms, and an SVG artifact.

3) List Pipeline Runs
GET /api/pipeline-runs/
Expect: latest runs including the one you just executed.

4) Adhoc Pipeline Run (without saving)
POST /api/pipeline/run/
```
{
  "asset_id": <svg_asset_id>,
  "steps": [
    {"type": "import", "params": {"layer": 1}},
    {"type": "simplify", "params": {"tolerance": 0.2}}
  ]
}
```

5) Raster Input with vtracer
- Upload a PNG/JPG asset
- Ensure `vtracer` is installed and in PATH
- Run saved or adhoc pipeline with first step `vectorize`

Troubleshooting
- 400 errors often indicate vpype or vtracer is not available or a step name/param mismatch.
- Permission 403: ensure the asset belongs to the same project as the pipeline and you are a member.
- Media: ensure media/ is writable; artifacts stored under `pipeline_runs/`.
