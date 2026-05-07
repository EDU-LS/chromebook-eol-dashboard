import logging

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api import audit, dashboard, devices, suggestions, tenants
from app.auth import get_current_user, hash_password, router as auth_router
from app.config import settings
from app.database import AsyncSessionLocal, engine
from app.models import Base, User
from app.sync.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")

logger = logging.getLogger(__name__)

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
app.include_router(audit.router, prefix="/api", **protected)

# Seed users: username → plain password
# The primary admin is read from env vars; extra users are listed here.
SEED_USERS = [
    (settings.auth_username, settings.auth_password),
    ("LSpencer",             "Px8#Qv2mKb"),
    ("HCripps",              "Rw5!Tn9cYj"),
]


async def seed_users():
    async with AsyncSessionLocal() as db:
        for username, plain_password in SEED_USERS:
            result = await db.execute(select(User).where(User.username == username))
            existing = result.scalar_one_or_none()
            if existing is None:
                db.add(User(username=username, hashed_password=hash_password(plain_password)))
                logger.info("Seeded user: %s", username)
            elif username == settings.auth_username:
                # Always sync the admin password from the env var so changing
                # AUTH_PASSWORD in Portainer takes effect on next redeploy.
                existing.hashed_password = hash_password(plain_password)
                logger.info("Refreshed password for admin user: %s", username)
        await db.commit()


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_users()
    start_scheduler()


@app.on_event("shutdown")
async def shutdown():
    stop_scheduler()


@app.get("/api/health")
async def health():
    return {"status": "ok"}
