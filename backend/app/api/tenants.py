"""Tenant CRUD and sync-trigger endpoints."""

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
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


@router.get("/{tenant_id}/sync-logs", response_model=list[SyncLogOut])
async def get_sync_logs(tenant_id: uuid.UUID, limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SyncLog).where(SyncLog.tenant_id == tenant_id)
        .order_by(SyncLog.started_at.desc()).limit(limit)
    )
    return result.scalars().all()
