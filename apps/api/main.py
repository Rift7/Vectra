from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.health import router as health_router
from routes.upload import router as upload_router
from routes.vectorize import router as vectorize_router
from routes.process import router as process_router
from routes.optimize import router as optimize_router
from routes.gcode import router as gcode_router
from routes.preview import router as preview_router
from routes.presets import router as presets_router
from routes.jobs import router as jobs_router

app = FastAPI(title="Vectra API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(health_router)
app.include_router(upload_router, prefix="/api")
app.include_router(vectorize_router, prefix="/api")
app.include_router(process_router, prefix="/api")
app.include_router(optimize_router, prefix="/api")
app.include_router(gcode_router, prefix="/api")
app.include_router(preview_router, prefix="/api")
app.include_router(presets_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
