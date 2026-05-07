import logging

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.api import dashboard, devices, suggestions, tenants
from app.auth import get_current_user, router as auth_router
from app.database import engine
from app.models import Base
from app.sync.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")

app = FastAPI(title="Eduthing Chromebook EOL Dashboard", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Public routes
app.include_router(auth_router, prefix="/api")

# Protected routes — require valid JWT
protected = {"dependencies": [Depends(get_current_user)]}
app.include_router(dashboard.router, prefix="/api", **protected)
app.include_router(tenants.router, prefix="/api", **protected)
app.include_router(devices.router, prefix="/api", **protected)
app.include_router(suggestions.router, prefix="/api", **protected)


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    start_scheduler()


@app.on_event("shutdown")
async def shutdown():
    stop_scheduler()


@app.get("/api/health")
async def health():
    return {"status": "ok"}
