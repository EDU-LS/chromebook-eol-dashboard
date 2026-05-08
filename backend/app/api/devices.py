"""Device listing endpoints — per-tenant and global views."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Device, Tenant
from app.schemas import DeviceOut, DeviceWithTenantOut

router = APIRouter(tags=["devices"])

# ── Global all-devices endpoint ───────────────────────────────────────────────

@router.get("/devices", response_model=list[DeviceWithTenantOut])
async def list_all_devices(
    search: Optional[str] = Query(None),
    tenant_id: Optional[uuid.UUID] = Query(None),
    is_flex: Optional[bool] = Query(None),
    limit: int = Query(10000, le=50000),
    db: AsyncSession = Depends(get_db),
):
    """Return all active devices across all tenants, with tenant name included."""
    q = (
        select(Device, Tenant.name.label("tenant_name"))
        .join(Tenant, Device.tenant_id == Tenant.id)
        .where(Device.status == "ACTIVE")
    )
    if tenant_id:
        q = q.where(Device.tenant_id == tenant_id)
    if is_flex is not None:
        q = q.where(Device.is_chromeos_flex == is_flex)
    q = q.order_by(Device.auto_update_expiration.asc().nullslast()).limit(limit)

    result = await db.execute(q)
    rows = result.all()

    devices = []
    for row in rows:
        d = row[0]
        out = DeviceWithTenantOut.model_validate(d)
        out.tenant_name = row[1]
        devices.append(out)

    # Client-side search across serial/model/user/location (fast enough at 2k rows)
    if search:
        q_lower = search.lower()
        devices = [
            d for d in devices if (
                q_lower in (d.serial_number or "").lower() or
                q_lower in (d.model or "").lower() or
                q_lower in (d.annotated_user or "").lower() or
                q_lower in (d.annotated_location or "").lower() or
                q_lower in (d.tenant_name or "").lower()
            )
        ]
    return devices


# ── Per-tenant devices endpoint ───────────────────────────────────────────────

per_tenant_router = APIRouter(prefix="/tenants/{tenant_id}/devices", tags=["devices"])


@per_tenant_router.get("", response_model=list[DeviceOut])
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
