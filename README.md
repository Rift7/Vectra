# Vectra

Vectra is a web-based slicer for pen plotters. Backend: Django, Celery, Channels. SPA frontend: React + Vite. Vector pipeline will wrap vpype; vectorization via vtracer.

## Tech decisions (MVP)
- Vectorizer: vtracer (default)
- Firmware: Marlin first (GRBL later)
- Frontend: SPA (React + Vite)
- Storage: Local disk for artifacts
- License: MIT
- Python: 3.13; Package manager: pip; Linting: ruff

## Development setup
1. Install Python 3.13 and Node 20+ (for frontend later)
2. Create virtualenv and install deps:
   ```bash
   python3.13 -m venv .venv
   source .venv/bin/activate
   pip install -U pip
   pip install -r requirements.txt -r requirements-dev.txt
   cp .env.example .env
   ```
3. Optional: start Postgres and Redis via Docker
   ```bash
   docker compose up -d postgres redis
   ```
4. Run initial migrations and start dev server
   ```bash
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py runserver
   ```
5. Start Celery worker (in another shell)
   ```bash
   celery -A vectra worker -l info
   ```

## Environment
- Database: reads POSTGRES_* from .env, falls back to SQLite if not set.
- Redis: REDIS_URL (default redis://localhost:6379/0) for Channels and Celery.
- Media: stored locally under MEDIA_ROOT (./media by default).

## Frontend
A React + Vite SPA lives under `frontend/`. It communicates via Django REST and receives live updates via Channels.

Dev:
- cd frontend && npm install && npm run dev
- Ensure you are logged in at /api-auth/login/ (same browser) so the WebSocket is authenticated
- The dev server proxies API (/api, /media) and WebSocket (/ws) to Django

## Vectorization (vtracer)
Raster-to-vector uses the vtracer CLI. Install it and ensure it's in PATH if you plan to vectorize PNG/JPG inputs:
- https://github.com/visioncortex/vtracer

In the pipeline API, include a first step:
```
{"type":"vectorize","params":{"mode":"centerline"}}
```
