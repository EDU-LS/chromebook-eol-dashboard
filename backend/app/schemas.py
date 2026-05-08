from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


# ── Tenant ────────────────────────────────────────────────────────────────────

class TenantCreate(BaseModel):
    name: str
    domain: str
    admin_email: EmailStr
    customer_id: str = "my_customer"
    device_replacement_cost: Decimal = Decimal("299.00")
    notes: Optional[str] = None


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    admin_email: Optional[EmailStr] = None
    customer_id: Optional[str] = None
    device_replacement_cost: Optional[Decimal] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class TenantOut(BaseModel):
    id: UUID
    name: str
    domain: str
    admin_email: str
    customer_id: str
    device_replacement_cost: Decimal
    is_active: bool
    notes: Optional[str]
    created_at: datetime
    last_synced_at: Optional[datetime]
    last_sync_status: str

    model_config = {"from_attributes": True}


# ── Device ────────────────────────────────────────────────────────────────────

class DeviceOut(BaseModel):
    id: UUID
    device_id: str
    serial_number: Optional[str]
    model: Optional[str]
    org_unit_path: Optional[str]
    status: Optional[str]
    auto_update_expiration: Optional[datetime]
    os_version: Optional[str]
    annotated_user: Optional[str]
    annotated_location: Optional[str]
    annotated_asset_id: Optional[str]
    last_sync: Optional[datetime]
    is_chromeos_flex: bool = False
    flex_eol_year: Optional[int] = None
    flex_status: Optional[str] = None

    model_config = {"from_attributes": True}


class DeviceWithTenantOut(DeviceOut):
    tenant_name: Optional[str] = None
    tenant_id: Optional[UUID] = None


# ── Dashboard ─────────────────────────────────────────────────────────────────

class TenantSummary(BaseModel):
    id: UUID
    name: str
    domain: str
    last_synced_at: Optional[datetime]
    last_sync_status: str
    device_replacement_cost: Decimal
    total_active: int
    expired: int
    expiring_6m: int
    expiring_12m: int
    expiring_24m: int
    pipeline_12m: Decimal
    pipeline_24m: Decimal


class DashboardSummary(BaseModel):
    total_tenants: int
    total_active_devices: int
    total_expired: int
    total_expiring_12m: int
    total_expiring_24m: int
    total_pipeline_12m: Decimal
    total_pipeline_24m: Decimal
    tenants: list[TenantSummary]


# ── Audit ─────────────────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: UUID
    username: str
    action: str
    detail: Optional[str]
    ip_address: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Suggestions ───────────────────────────────────────────────────────────────

class SuggestionCreate(BaseModel):
    title: str
    category: str = "Other"
    description: Optional[str] = None
    submitted_by: Optional[str] = None


class CommentOut(BaseModel):
    id: UUID
    suggestion_id: UUID
    content: str
    author: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    content: str
    author: str


class SuggestionOut(BaseModel):
    id: UUID
    title: str
    category: str
    description: Optional[str]
    submitted_by: Optional[str]
    status: str
    created_at: datetime
    comments: list[CommentOut] = []

    model_config = {"from_attributes": True}


# ── Sync ──────────────────────────────────────────────────────────────────────

class SyncLogOut(BaseModel):
    id: UUID
    tenant_id: UUID
    started_at: datetime
    completed_at: Optional[datetime]
    status: str
    devices_synced: int
    error_message: Optional[str]

    model_config = {"from_attributes": True}
