"""Device listing endpoint — per-tenant device detail view."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Device, Tenant
from app.schemas import DeviceOut

router = APIRouter(prefix="/tenants/{tenant_id}/devices", tags=["devices"])


@router.get("", response_model=list[DeviceOut])
async def list_devices(
    tenant_id: uuid.UUID,
    status: Optional[str] = Query(None, description="Filter by status e.g. ACTIVE"),
    eol_within_months: Optional[int] = Query(None, ge=1, le=60),
    skip: int = 0,
    limit: int = 500,
    db: AsyncSession = Depends(get_db),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    q = select(Device).where(Device.tenant_id == tenant_id)

    if status:
        q = q.where(Device.status == status.upper())

    if eol_within_months is not None:
        from sqlalchemy import func, text
        q = q.where(
            Device.auto_update_expiration <= func.now() + text(f"INTERVAL '{eol_within_months} months'")
        ).where(Device.auto_update_expiration.isnot(None))

    q = q.order_by(Device.auto_update_expiration.asc().nullslast()).offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()
