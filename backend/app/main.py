import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import dashboard, devices, tenants
from app.database import engine
from app.models import Base
from app.sync.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")

app = FastAPI(title="Eduthing Chromebook EOL Dashboard", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Caddy handles external access control
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router, prefix="/api")
app.include_router(tenants.router, prefix="/api")
app.include_router(devices.router, prefix="/api")


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
