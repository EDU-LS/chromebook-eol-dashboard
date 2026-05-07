"""
Standalone sync worker with APScheduler.
Can also run once with: python run_sync.py --now
"""

import asyncio
import logging
import os
import sys

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("worker")

DATABASE_URL = os.environ["DATABASE_URL"]
SERVICE_ACCOUNT_B64 = os.environ["SERVICE_ACCOUNT_B64"]
SYNC_HOUR = int(os.getenv("SYNC_HOUR", "2"))
SYNC_MINUTE = int(os.getenv("SYNC_MINUTE", "0"))

engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

sys.path.insert(0, "/app")
from app.sync.engine import run_full_sync  # noqa: E402


async def do_sync():
    logger.info("Starting sync run")
    results = await run_full_sync(SessionLocal, SERVICE_ACCOUNT_B64)
    logger.info("Sync complete: %s", results)


def main():
    if "--now" in sys.argv:
        asyncio.run(do_sync())
        return

    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(do_sync, trigger=CronTrigger(hour=SYNC_HOUR, minute=SYNC_MINUTE),
                      id="nightly_sync", misfire_grace_time=3600)
    scheduler.start()
    logger.info("Worker scheduled — sync at %02d:%02d UTC", SYNC_HOUR, SYNC_MINUTE)

    try:
        asyncio.get_event_loop().run_forever()
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()


if __name__ == "__main__":
    main()
