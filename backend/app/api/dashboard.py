"""Dashboard aggregate endpoints — the main data source for the frontend."""

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import DashboardSummary, TenantSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_SUMMARY_SQL = text("""
    SELECT
        t.id,
        t.name,
        t.domain,
        t.last_synced_at,
        t.last_sync_status,
        t.device_replacement_cost,
        COUNT(d.id) FILTER (WHERE d.status = 'ACTIVE')                                                   AS total_active,
        COUNT(d.id) FILTER (WHERE d.auto_update_expiration < NOW() AND d.status = 'ACTIVE')               AS expired,
        COUNT(d.id) FILTER (WHERE d.auto_update_expiration BETWEEN NOW() AND NOW() + INTERVAL '6 months'
                             AND d.status = 'ACTIVE')                                                     AS expiring_6m,
        COUNT(d.id) FILTER (WHERE d.auto_update_expiration BETWEEN NOW() AND NOW() + INTERVAL '12 months'
                             AND d.status = 'ACTIVE')                                                     AS expiring_12m,
        COUNT(d.id) FILTER (WHERE d.auto_update_expiration BETWEEN NOW() AND NOW() + INTERVAL '24 months'
                             AND d.status = 'ACTIVE')                                                     AS expiring_24m,
        COALESCE(t.device_replacement_cost * COUNT(d.id) FILTER (
            WHERE d.auto_update_expiration < NOW() + INTERVAL '12 months'
              AND d.status = 'ACTIVE'
        ), 0) AS pipeline_12m,
        COALESCE(t.device_replacement_cost * COUNT(d.id) FILTER (
            WHERE d.auto_update_expiration < NOW() + INTERVAL '24 months'
              AND d.status = 'ACTIVE'
        ), 0) AS pipeline_24m
    FROM tenants t
    LEFT JOIN devices d ON d.tenant_id = t.id
    WHERE t.is_active = TRUE
    GROUP BY t.id, t.name, t.domain, t.last_synced_at, t.last_sync_status, t.device_replacement_cost
    ORDER BY pipeline_24m DESC NULLS LAST
""")


@router.get("", response_model=DashboardSummary)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(_SUMMARY_SQL)).mappings().all()

    tenants = [TenantSummary(**dict(r)) for r in rows]

    return DashboardSummary(
        total_tenants=len(tenants),
        total_active_devices=sum(t.total_active for t in tenants),
        total_expired=sum(t.expired for t in tenants),
        total_expiring_12m=sum(t.expiring_12m for t in tenants),
        total_expiring_24m=sum(t.expiring_24m for t in tenants),
        total_pipeline_12m=sum(t.pipeline_12m for t in tenants),
        total_pipeline_24m=sum(t.pipeline_24m for t in tenants),
        tenants=tenants,
    )
