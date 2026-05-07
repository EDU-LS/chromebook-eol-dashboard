"""APScheduler wrapper — nightly sync at configurable UTC time."""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.database import AsyncSessionLocal
from app.sync.engine import run_full_sync

logger = logging.getLogger(__name__)
_scheduler = AsyncIOScheduler(timezone="UTC")


def start_scheduler():
    _scheduler.add_job(
        _nightly_sync,
        trigger=CronTrigger(hour=settings.sync_hour, minute=settings.sync_minute),
        id="nightly_sync",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.start()
    logger.info("Scheduler started — nightly sync at %02d:%02d UTC", settings.sync_hour, settings.sync_minute)


def stop_scheduler():
    _scheduler.shutdown(wait=False)


async def _nightly_sync():
    logger.info("Nightly sync triggered by scheduler")
    await run_full_sync(AsyncSessionLocal, settings.service_account_b64)
