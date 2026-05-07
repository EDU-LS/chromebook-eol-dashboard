"""Tenant CRUD and sync-trigger endpoints."""

import csv
import io
import uuid
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import write_audit
from app.auth import get_current_user
from app.config import settings
from app.database import AsyncSessionLocal, get_db
from app.models import SyncLog, Tenant
from app.schemas import SyncLogOut, TenantCreate, TenantOut, TenantUpdate
from app.sync.engine import run_full_sync

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("", response_model=list[TenantOut])
async def list_tenants(active_only: bool = True, db: AsyncSession = Depends(get_db)):
    q = select(Tenant).order_by(Tenant.name)
    if active_only:
        q = q.where(Tenant.is_active == True)  # noqa: E712
    return (await db.execute(q)).scalars().all()


@router.post("", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    body: TenantCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    if (await db.execute(select(Tenant).where(Tenant.domain == body.domain))).scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Domain {body.domain} already exists")
    tenant = Tenant(**body.model_dump())
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)
    await write_audit(db, current_user, "tenant_created",
                      f"Added customer: {tenant.name} ({tenant.domain})",
                      request.client.host if request.client else None)
    return tenant


@router.get("/{tenant_id}", response_model=TenantOut)
async def get_tenant(tenant_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.patch("/{tenant_id}", response_model=TenantOut)
async def update_tenant(
    tenant_id: uuid.UUID,
    body: TenantUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(tenant, field, value)
    await db.commit()
    await db.refresh(tenant)
    await write_audit(db, current_user, "tenant_updated",
                      f"Updated customer: {tenant.name} ({tenant.domain})",
                      request.client.host if request.client else None)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(
    tenant_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    name = tenant.name
    domain = tenant.domain
    await db.delete(tenant)
    await db.commit()
    await write_audit(db, current_user, "tenant_deleted",
                      f"Removed customer: {name} ({domain})",
                      request.client.host if request.client else None)


@router.post("/{tenant_id}/sync", status_code=status.HTTP_202_ACCEPTED)
async def trigger_sync(
    tenant_id: uuid.UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    background_tasks.add_task(run_full_sync, AsyncSessionLocal, settings.service_account_b64, tenant_id)
    await write_audit(db, current_user, "sync_triggered",
                      f"Manual sync: {tenant.name} ({tenant.domain})",
                      request.client.host if request.client else None)
    return {"message": f"Sync started for {tenant.domain}"}


@router.post("/sync/all", status_code=status.HTTP_202_ACCEPTED)
async def trigger_full_sync(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: str = Depends(get_current_user),
):
    background_tasks.add_task(run_full_sync, AsyncSessionLocal, settings.service_account_b64)
    from app.database import AsyncSessionLocal as _sl
    async with _sl() as db:
        await write_audit(db, current_user, "sync_all",
                          "Manual sync triggered for all customers",
                          request.client.host if request.client else None)
    return {"message": "Full sync started"}


@router.post("/import", status_code=status.HTTP_200_OK)
async def import_tenants_csv(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """
    Bulk import customers from a CSV file.
    Expected columns (header row required):
      Name, Domain, Admin Email, Customer ID, Replacement Cost, Notes
    Customer ID, Replacement Cost and Notes are optional.
    """
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # handle Excel BOM
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))

    # Normalise header names — strip whitespace, lowercase for matching
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV has no headers")

    added, skipped, errors = 0, 0, []

    for row_num, row in enumerate(reader, start=2):  # start=2 because row 1 is header
        # Strip whitespace from all values
        row = {k.strip(): (v or "").strip() for k, v in row.items()}

        name         = row.get("Name") or row.get("name", "")
        domain       = row.get("Domain") or row.get("domain", "")
        admin_email  = row.get("Admin Email") or row.get("admin_email", "")
        customer_id  = row.get("Customer ID") or row.get("customer_id") or "my_customer"
        cost_raw     = row.get("Replacement Cost") or row.get("replacement_cost") or "299.00"
        notes        = row.get("Notes") or row.get("notes") or None

        if not name or not domain or not admin_email:
            errors.append({"row": row_num, "domain": domain or "?", "error": "Name, Domain and Admin Email are required"})
            continue

        try:
            cost = Decimal(cost_raw.replace("£", "").replace(",", ""))
        except InvalidOperation:
            cost = Decimal("299.00")

        # Skip if domain already exists
        existing = (await db.execute(select(Tenant).where(Tenant.domain == domain))).scalar_one_or_none()
        if existing:
            skipped += 1
            continue

        db.add(Tenant(
            name=name,
            domain=domain,
            admin_email=admin_email,
            customer_id=customer_id,
            device_replacement_cost=cost,
            notes=notes,
        ))
        added += 1

    await db.commit()
    await write_audit(
        db, current_user, "tenant_csv_import",
        f"CSV import: {added} added, {skipped} skipped, {len(errors)} errors",
        request.client.host if request.client else None,
    )
    return {"added": added, "skipped": skipped, "errors": errors}


@router.get("/{tenant_id}/sync-logs", response_model=list[SyncLogOut])
async def get_sync_logs(tenant_id: uuid.UUID, limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SyncLog).where(SyncLog.tenant_id == tenant_id)
        .order_by(SyncLog.started_at.desc()).limit(limit)
    )
    return result.scalars().all()
