"""
Core sync engine — iterates tenants, calls Google API, upserts to Postgres.
"""

import asyncio
import logging
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import Device, SyncLog, Tenant
from app.sync.google_client import (
    get_delegated_credentials,
    list_chrome_devices,
    parse_aue_date,
    parse_google_datetime,
)

logger = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=10, thread_name_prefix="google-api")
_CONCURRENCY = 5


async def run_full_sync(
    session_factory: async_sessionmaker,
    service_account_b64: str,
    tenant_id: Optional[uuid.UUID] = None,
) -> dict:
    """Entry point for nightly scheduler and on-demand API triggers."""
    async with session_factory() as session:
        if tenant_id:
            row = await session.get(Tenant, tenant_id)
            tenants = [row] if row else []
        else:
            result = await session.execute(
                select(Tenant).where(Tenant.is_active == True).order_by(Tenant.name)
            )
            tenants = list(result.scalars().all())

    if not tenants:
        logger.warning("No active tenants to sync")
        return {"synced": 0, "failed": 0}

    logger.info("Starting sync for %d tenant(s)", len(tenants))
    semaphore = asyncio.Semaphore(_CONCURRENCY)
    results = {"synced": 0, "failed": 0}

    async def _bounded_sync(tenant: Tenant):
        async with semaphore:
            async with session_factory() as session:
                ok = await sync_tenant(tenant.id, session, service_account_b64)
                if ok:
                    results["synced"] += 1
                else:
                    results["failed"] += 1

    await asyncio.gather(*[_bounded_sync(t) for t in tenants], return_exceptions=True)
    logger.info("Sync complete — %d succeeded, %d failed", results["synced"], results["failed"])
    return results


async def sync_tenant(
    tenant_id: uuid.UUID,
    session: AsyncSession,
    service_account_b64: str,
) -> bool:
    """Sync a single tenant. Returns True on success."""
    tenant: Optional[Tenant] = await session.get(Tenant, tenant_id)
    if not tenant:
        logger.error("Tenant %s not found", tenant_id)
        return False

    log = SyncLog(tenant_id=tenant_id, status="running")
    session.add(log)
    await session.flush()
    log_id = log.id

    logger.info("Syncing tenant: %s (%s)", tenant.name, tenant.domain)

    try:
        creds = get_delegated_credentials(
            service_account_b64=service_account_b64,
            subject=tenant.admin_email,
        )

        loop = asyncio.get_event_loop()
        raw_devices: list[dict] = await loop.run_in_executor(
            _executor,
            list_chrome_devices,
            creds,
            tenant.customer_id,
        )

        count = await _upsert_devices(session, tenant_id, raw_devices)

        now = datetime.now(timezone.utc)
        await session.execute(
            update(Tenant).where(Tenant.id == tenant_id)
            .values(last_synced_at=now, last_sync_status="success")
        )
        await session.execute(
            update(SyncLog).where(SyncLog.id == log_id)
            .values(status="success", devices_synced=count, completed_at=now)
        )
        await session.commit()
        logger.info("Synced %d devices for %s", count, tenant.domain)
        return True

    except Exception as exc:
        logger.exception("Sync failed for %s: %s", tenant.domain, exc)
        await session.rollback()
        try:
            async with session.bind.connect() as conn:
                await conn.execute(
                    text("""
                        UPDATE sync_logs SET status='failed',
                        error_message=:msg, completed_at=NOW() WHERE id=:id
                    """),
                    {"id": str(log_id), "msg": str(exc)[:2000]},
                )
                await conn.execute(
                    text("UPDATE tenants SET last_sync_status='failed' WHERE id=:id"),
                    {"id": str(tenant_id)},
                )
                await conn.commit()
        except Exception as inner:
            logger.error("Could not write failure log: %s", inner)
        return False


async def _upsert_devices(
    session: AsyncSession,
    tenant_id: uuid.UUID,
    raw_devices: list[dict],
) -> int:
    """Bulk-upsert devices. Returns count upserted."""
    if not raw_devices:
        return 0

    rows = []
    for d in raw_devices:
        status = d.get("status", "")
        if status == "DEPROVISIONED":
            continue
        rows.append({
            "id": uuid.uuid4(),
            "tenant_id": tenant_id,
            "device_id": d["deviceId"],
            "serial_number": d.get("serialNumber"),
            "model": d.get("model"),
            "org_unit_path": d.get("orgUnitPath"),
            "status": status,
            "auto_update_expiration": parse_aue_date(d.get("autoUpdateExpiration")),
            "last_enrolled_time": parse_google_datetime(d.get("lastEnrollmentTime")),
            "last_sync": parse_google_datetime(d.get("lastSync")),
            "os_version": d.get("osVersion"),
            "annotated_user": d.get("annotatedUser"),
            "annotated_location": d.get("annotatedLocation"),
            "annotated_asset_id": d.get("annotatedAssetId"),
            "updated_at": datetime.now(timezone.utc),
        })

    if not rows:
        return 0

    stmt = pg_insert(Device).values(rows)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_tenant_device",
        set_={
            "serial_number": stmt.excluded.serial_number,
            "model": stmt.excluded.model,
            "org_unit_path": stmt.excluded.org_unit_path,
            "status": stmt.excluded.status,
            "auto_update_expiration": stmt.excluded.auto_update_expiration,
            "last_enrolled_time": stmt.excluded.last_enrolled_time,
            "last_sync": stmt.excluded.last_sync,
            "os_version": stmt.excluded.os_version,
            "annotated_user": stmt.excluded.annotated_user,
            "annotated_location": stmt.excluded.annotated_location,
            "annotated_asset_id": stmt.excluded.annotated_asset_id,
            "updated_at": stmt.excluded.updated_at,
        },
    )
    await session.execute(stmt)
    return len(rows)
