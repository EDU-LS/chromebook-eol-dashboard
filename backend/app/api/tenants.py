"""Tenant CRUD and sync-trigger endpoints."""

import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal, get_db
from app.models import SyncLog, Tenant
from app.schemas import SyncLogOut, TenantCreate, TenantOut, TenantUpdate
from app.sync.engine import run_full_sync, sync_tenant

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("", response_model=list[TenantOut])
async def list_tenants(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    q = select(Tenant).order_by(Tenant.name)
    if active_only:
        q = q.where(Tenant.is_active == True)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
async def create_tenant(body: TenantCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Tenant).where(Tenant.domain == body.domain))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Domain {body.domain} already exists")

    tenant = Tenant(**body.model_dump())
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)
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
    db: AsyncSession = Depends(get_db),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(tenant, field, value)

    await db.commit()
    await db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(tenant_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    await db.delete(tenant)
    await db.commit()


@router.post("/{tenant_id}/sync", status_code=status.HTTP_202_ACCEPTED)
async def trigger_sync(
    tenant_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Kick off an on-demand sync for a single tenant (runs in background)."""
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    background_tasks.add_task(
        run_full_sync,
        AsyncSessionLocal,
        settings.service_account_file,
        tenant_id,
    )
    return {"message": f"Sync started for {tenant.domain}"}


@router.post("/sync/all", status_code=status.HTTP_202_ACCEPTED)
async def trigger_full_sync(background_tasks: BackgroundTasks):
    """Kick off a full sync across all active tenants."""
    background_tasks.add_task(
        run_full_sync,
        AsyncSessionLocal,
        settings.service_account_file,
    )
    return {"message": "Full sync started"}


@router.get("/{tenant_id}/sync-logs", response_model=list[SyncLogOut])
async def get_sync_logs(
    tenant_id: uuid.UUID,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SyncLog)
        .where(SyncLog.tenant_id == tenant_id)
        .order_by(SyncLog.started_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
