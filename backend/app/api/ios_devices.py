"""iOS device endpoints — per-tenant list and LightSpeed CSV import."""

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import IosDevice, Tenant
from app.schemas import IosDeviceOut

router = APIRouter(prefix="/tenants/{tenant_id}/ios-devices", tags=["ios-devices"])


def _parse_checkin(val: str) -> Optional[datetime]:
    """Parse LightSpeed checkin datetime: '05/10/2026 02:18 PM' or '05/10/2026 09:18'."""
    if not val or not val.strip():
        return None
    for fmt in ("%m/%d/%Y %I:%M %p", "%m/%d/%Y %H:%M"):
        try:
            return datetime.strptime(val.strip(), fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


@router.get("", response_model=list[IosDeviceOut])
async def list_ios_devices(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    result = await db.execute(
        select(IosDevice)
        .where(IosDevice.tenant_id == tenant_id)
        .order_by(IosDevice.device_name)
    )
    return result.scalars().all()


@router.post("/import")
async def import_ios_devices(
    tenant_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # strip BOM if present
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))

    # Deduplicate by UDID — a device can appear in multiple rows (one per group).
    # Collect all group names; keep device data from first occurrence.
    by_udid: dict[str, dict] = {}
    for row in reader:
        udid = (row.get("udid") or "").strip()
        if not udid:
            continue
        group = (row.get("Group Name") or "").strip()
        if udid in by_udid:
            # Append group if not already listed
            existing = by_udid[udid]["group_name"]
            if group and group not in existing.split(", "):
                by_udid[udid]["group_name"] = f"{existing}, {group}" if existing else group
        else:
            by_udid[udid] = {
                "udid": udid,
                "serial_number":  (row.get("serial number") or "").strip() or None,
                "device_name":    (row.get("name")          or "").strip() or None,
                "product_name":   (row.get("product name")  or "").strip() or None,
                "model_name":     (row.get("device model name") or "").strip() or None,
                "model_number":   (row.get("model number")  or "").strip() or None,
                "os_version":     (row.get("os version")    or "").strip() or None,
                "asset_tag":      (row.get("asset tag")     or "").strip() or None,
                "supervised":     (row.get("supervised")    or "false").strip().lower() == "true",
                "last_checkin":   _parse_checkin(row.get("Last checkin") or ""),
                "assigned_user":  (row.get("username")      or "").strip() or None,
                "school_name":    (row.get("School Name")   or "").strip() or None,
                "group_name":     group,
            }

    # Full replacement — delete all existing iOS records for this tenant, then insert fresh
    await db.execute(delete(IosDevice).where(IosDevice.tenant_id == tenant_id))

    now = datetime.now(timezone.utc)
    for d in by_udid.values():
        db.add(IosDevice(tenant_id=tenant_id, imported_at=now, updated_at=now, **d))

    await db.commit()
    return {"imported": len(by_udid), "school_name": next(iter(by_udid.values()), {}).get("school_name")}
