# Live Preview (Channels + WebSocket)

Backend
- WebSocket endpoint: ws://127.0.0.1:8000/ws/preview/run/
- Auth: uses Django session via Channels' AuthMiddlewareStack (login at /api-auth/login/ first)
- Message format:
  - Client -> server:
    {"action":"run","asset_id":1,"steps":[ {"type":"import","params":{"layer":1}}, ... ]}
  - Server -> client events:
    - {"event":"connected"}
    - {"event":"start","asset_id":1}
    - {"event":"status","stage":"preprocess","suffix":".svg"}
    - {"event":"step","name":"simplify","status":"done"}
    - {"event":"artifact","kind":"svg","path":"/abs/path/to/output.svg"}
    - {"event":"completed","steps":[...],"output_svg_url":"/media/...","output_gcode_url":"/media/..."}

Frontend (dev)
- A minimal React + Vite SPA is scaffolded under `frontend/` with a form to connect, send a run request, and display events.
- To run:
  ```bash
  cd frontend
  npm install
  npm run dev
  ```
- Open http://localhost:5173 and provide asset_id and steps JSON.

Notes
- Now uses Celery tasks for execution and Channels groups for progress streaming. Make sure a Celery worker is running:
  ```bash
  celery -A vectra worker -l info
  ```
- WebSocket receives events: connected, queued, start, status, step, artifact, completed, error.
