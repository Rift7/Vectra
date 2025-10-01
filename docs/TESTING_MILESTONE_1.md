# Testing Milestone 1 (Backend Bootstrap)

This guide validates DB, auth, media uploads, and Celery worker.

## 0) Prereqs
- Python 3.13, virtualenv active
- Postgres + Redis running (via Docker) or use SQLite + local Redis
- Superuser created (`python manage.py createsuperuser`)

Optionally set Celery eager mode to avoid starting a worker during a quick test:
```
# .env
CELERY_TASK_ALWAYS_EAGER=1
```

## 1) Run server
```
python manage.py migrate
python manage.py runserver
```

## 2) Login to browsable API
- Navigate to http://127.0.0.1:8000/api-auth/login/
- Use your superuser credentials

## 3) Projects API
- Create a project (POST) at http://127.0.0.1:8000/api/projects/
Body (JSON):
```
{"name": "Test Project", "description": "Hello Vectra"}
```
- List projects: GET http://127.0.0.1:8000/api/projects/

Curl with BasicAuth (replace user:pass):
```
curl -u user:pass -H 'Content-Type: application/json' \
  -d '{"name":"Test Project"}' \
  http://127.0.0.1:8000/api/projects/
```

## 4) Asset upload
- Upload a file (POST) at http://127.0.0.1:8000/api/assets/
- Use multipart form with fields: `project`, `media_type` (svg|pdf|png|jpg), and `file`

Curl example (replace ids and file path):
```
curl -u user:pass -F project=1 -F media_type=svg \
  -F file=@/path/to/your/test.svg \
  http://127.0.0.1:8000/api/assets/
```
- Verify file saved under `MEDIA_ROOT/assets/...`
- In DEBUG, media is served at /media/, so GET the `file` URL from the response

## 5) Celery ping
- Eager mode (no worker):
```
curl -u user:pass -X POST http://127.0.0.1:8000/api/celery/ping/
# Response includes eager: true and a task_id
curl -u user:pass http://127.0.0.1:8000/api/celery/result/<task_id>/
```
- With worker running:
```
celery -A vectra worker -l info
# In another shell, trigger the task
curl -u user:pass -X POST http://127.0.0.1:8000/api/celery/ping/
```
Check the worker log for the task execution and use the result endpoint to confirm.

## 6) Admin UI
- http://127.0.0.1:8000/admin/ -> manage Projects and Assets

## Troubleshooting
- DB: ensure Postgres env vars match docker-compose or remove to fall back to SQLite.
- Redis: required for Channels and Celery (except eager mode). Use REDIS_URL in .env.
- Media permissions: ensure `media/` is writable.
- Auth errors: log in via /api-auth/ or use BasicAuth with -u user:pass.
