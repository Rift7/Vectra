# Vectra Project Plan

## Executive Summary
Vectra is a web-based “slicer for plotters” that converts images and vectors into optimized G-code for pen plotters and similar CNC devices. Built with Django and wrapping vpype as the vector-processing pipeline, Vectra provides image editing, smart vector preparation, and a live G-code preview. The first release will target Marlin-style G-code plotters (GRBL support later), with an architecture that can extend to HPGL and device-specific protocols (e.g., AxiDraw) later.

## MVP Decisions
- Vectorizer: vtracer (default); potrace deferred
- Firmware target: Marlin first (GRBL later)
- Frontend: SPA (React + Vite) backed by Django REST + Channels
- Storage: Local disk for artifacts (S3-compatible later)
- License: MIT
- Python: 3.13; Dependency manager: pip; Linting: ruff

## Goals
- Create a reliable, reproducible workflow to go from input artwork (SVG/PDF/PNG/JPG) to optimized G-code.
- Provide a clean, approachable UI with live previews and progressive updates during processing.
- Wrap vpype as the core vector pipeline, exposing curated operations as configurable “nodes/steps.”
- Offer smart vector prep (simplify, merge, sort, hatch, fills, stipple, halftone, and pen-up/pen-down optimization).
- Support project management for assets, pipelines, machine profiles, and job runs.
- Provide a plugin-friendly architecture for new pipeline steps and post-processors.

## Non-Goals (initially)
- Full CAD/vector editing suite (we provide light editing/ops; complex editing remains in external tools).
- Real-time machine control (initial focus on code generation and preview, not direct device control).
- Broad device protocol coverage (start with G-code; add HPGL/AxiDraw later).

## Target Users and UX Principles
- Hobbyists and artists using GRBL/Marlin pen plotters; educators; makers.
- UX: direct, forgiving, preview-driven; sensible defaults with advanced controls available.
- Provide presets for common paper sizes, pens, materials, and plotters.

## Core Features
1) Import and asset management
- Upload SVG/PDF/PNG/JPG; basic file browser and versioned assets
- Project workspaces grouping assets, pipeline configs, and outputs

2) Image editing and vectorization
- Basic filters: grayscale, invert, brightness/contrast, thresholding
- Raster-to-vector via vtracer/potrace (selectable), then into vpype pipeline

3) Vector prep (vpype-powered)
- Geometry ops: scale, rotate, translate, fit to page, crop
- Quality ops: simplify (tolerance), merge lines, remove duplicates, split/join, filter short segments
- Tooling ops: line sort (minimize travel), re-loop ordering, pen-lift optimization
- Artistic ops: hatch fills (angle, spacing), stippling/halftone (variable density), contour/offset

4) G-code generation and post-processing
- Machine profiles: bed size, origin, units, feed rates, accelerations, pen-up/down commands (servo PWM or Z), safe travel
- Post-processors for GRBL/Marlin; preamble/postamble templates; unit conversions; arc support if needed
- Multi-tool (pen/color) support via layer-to-tool mapping and pauses for pen changes

5) Live preview
- 2D vector preview from generated toolpaths
- Timeline/animation control to scrub through G-code
- Progressive preview while pipeline runs; WebSocket updates

6) Jobs and history
- Queue jobs; track status; store outputs (SVG, G-code) and parameters for reproducibility
- Compare outputs across pipeline versions (diff metrics: length, time, segments)

## Architecture Overview
- Backend: Django 5 (Python 3.11+), PostgreSQL, Redis, Celery, Django Channels (WebSockets)
- Vector pipeline: vpype Python API used as a library; plugin ops wrapped behind typed parameter schemas
- Image processing: Pillow/OpenCV for raster filters; vtracer/potrace for vectorization
- G-code: pluggable post-processing layer with profile-specific templates and unit handling
- Frontend: SPA (React + Vite) backed by Django REST + Channels; Django Admin for internal administration

### High-level Components
- App: `projects` – Project, Asset, Versioning
- App: `pipeline` – Pipeline definitions, steps, parameter schemas, execution orchestration
- App: `machines` – MachineProfile, Tools, Materials, Post-Processor configs
- App: `jobs` – Job model, Celery tasks, artifacts storage, logs
- App: `preview` – Preview endpoints, Channels server, progressive updates
- Shared: `core` – Utilities, storage abstraction, permissions, settings

## Data Model (initial draft)
- User (auth)
- Project: name, description, owner, collaborators
- Asset: project FK, file blob/meta, type (SVG/PDF/PNG/JPG), versions
- Pipeline: project FK, list of Steps (ordered), default parameters
- PipelineStep: type (enum), param JSON (validated by Pydantic), enabled flag
- MachineProfile: name, bed_size, origin, units, feedrates, accel, pen-up/down method, z/servo mapping
- Tool (Pen): color, width, offsets, pressure/servo settings
- Material: name, notes, recommended speeds
- Job: project/pipeline/machine/tool mapping, status, logs, metrics (path length, est time)
- Artifact: job FK, type (SVG/GCODE/PNG), storage path, checksum

## Pipeline Design with vpype
- Each PipelineStep corresponds to a vpype operation or a composed sequence.
- Steps define a Pydantic schema for parameters and a runner function that mutates a vpype Document.
- Step registry allows discovery and UI auto-generation (forms from schemas).
- Example step categories:
  - Import: read SVG/PDF or vectorize raster; normalize units
  - Layout: page size, fit, margin, crop
  - Optimization: simplify, linemerge, linesort, deduplicate, splitall
  - Artistic: hatch, stipple/halftone, contour; layer/color mapping
  - Output: flatten layers, tool mapping, final sort

### Execution Flow
1) Resolve asset -> if raster, process filters then vectorize
2) Build vpype Document via import step
3) Run sequence of vpype ops per step registry
4) Export toolpaths (polylines) -> feed to post-processor
5) Generate G-code, persist artifacts, and emit preview frames progressively

## G-code Generation
- Post-processors: Marlin (V1), GRBL (future), HPGL (future), AxiDraw (future)
- Profiles define: units (mm/in), feed rate defaults, pen-up/down commands (M3/M5 or servo PWM via M280), Z heights, travel speed, accelerations (if applicable)
- Templates: preamble/postamble; tool-change scripts; pause prompts
- Path planning: respect layer-to-tool mapping; minimize lifts; handle safe Z moves
- Time estimation: derive from segment lengths and feed rates; include lifts and tool changes

## Live Preview Design
- Backend generates simplified polylines per path segment with timestamps
- WebSocket channel streams batches: {path_id, points[], pen_state, t0, t1}
- Frontend Canvas renders strokes; supports scrub/play and color-by-tool/layer
- Progressive: pipeline can stream early previews (e.g., post-optimization but before G-code)

## Import/Export and Formats
- Import: SVG, PDF (vector), PNG/JPG (raster)
- Export: SVG (optimized), G-code; preview PNG snapshots
- Metadata: embed job and pipeline details in G-code comments for reproducibility

## Security & Permissions
- Per-project ACL; signed URLs for artifacts; size quotas; virus scanning for uploads (ClamAV optional)

## Performance & Scalability
- Offload heavy work to Celery workers; cache intermediate results
- Limit max geometry complexity per plan; progressive UX for long jobs
- Use vector simplification thresholds carefully; expose “preview-quality” vs “final-quality” modes

## Testing Strategy
- Unit tests for step runners and post-processors (property-based tests on geometries)
- Golden-file tests: same input/pipeline -> identical G-code aside from timestamps/comments
- Integration tests for job orchestration and artifact persistence
- Frontend tests for preview rendering logic (Playwright for canvas snapshots)

## Observability
- Structured logs for pipeline steps and job timings
- Metrics: total path length, segments, lifts, estimated time vs actual
- Error reporting (Sentry)

## Milestones & Timeline (indicative, 10 weeks)
1) Week 1: Project bootstrap (Django, Postgres, Redis, Celery, Channels). Basic models, auth, projects, assets.
2) Week 2: vpype integration skeleton; step registry; Pydantic schemas; a handful of basic ops (import, scale, simplify).
3) Week 3: Raster filters + vectorization (vtracer/potrace). Basic pipeline UI (build steps, set params).
4) Week 4: Core optimizations (linemerge, linesort, dedupe) and artifacts storage.
5) Week 5: Post-processors (GRBL/Marlin) and machine profiles.
6) Week 6: Live preview backend (Channels) and canvas UI; progressive updates.
7) Week 7: Artistic ops (hatch, stipple/halftone) and tool/layer mapping; multi-tool flow.
8) Week 8: Jobs history, comparisons, metrics, polish.
9) Week 9: Test hardening, perf tuning, docs, sample presets.
10) Week 10: Beta release, feedback, and backlog grooming.

## Risks & Mitigations
- Raster-to-vector quality variability: provide multiple vectorizers and tunable params; preview modes.
- Large SVG/PDF performance: cap complexity; offer downsampling and staged processing.
- G-code correctness across firmwares: separate post-processors; feature flags per profile.
- Web preview performance: level-of-detail rendering; chunked streaming; requestAnimationFrame scheduling.

## Open Questions
- Which vectorizer(s) do we prefer for MVP (vtracer vs potrace)?
- Required plotter firmwares for launch (GRBL only or include Marlin)?
- Do we need HPGL in V1 or defer to V2?
- Frontend approach: HTMX-first vs small SPA for the preview-heavy pages?
- Storage backend: local disk vs S3-compatible for artifacts?

## Initial Backlog (MVP scope)
- Bootstrap Django project and core apps
- Implement Asset storage and SVG/PNG import
- Step registry with 3 ops: import, simplify, linesort
- GRBL post-processor with pen-up/down via Z moves
- Machine profile model with defaults and pre/postamble
- Live preview rendering for simple paths
- Job orchestration and artifact persistence
- Basic UI to assemble pipeline and run job

## Appendix: vpype Ops Mapping (examples)
- simplify: tolerance -> vpype.simplify(tol)
- linemerge: depth, max_error -> vpype.linemerge(...)
- linesort: strategy (nearest, tsp, layer-aware) -> vpype.linesort(mode)
- crop: rectangle/margins -> vpype.crop(...)
- reloop: reorder path start -> vpype.reloop(...)
- hatch: angle, spacing -> plugin.hatch(...)

## License and Dependencies
- Vectra: MIT
- Dependencies: Django 5.x, djangorestframework, channels, channels-redis, celery, redis, psycopg[binary], pillow, python-dotenv, vpype (+ plugins later), vtracer
- Dev: ruff
- Frontend: Node 20+, React, Vite
