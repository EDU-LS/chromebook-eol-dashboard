import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer,
    Numeric, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    domain = Column(String(255), unique=True, nullable=False, index=True)
    # Admin email used for DWD impersonation — must be a Super Admin in that Workspace
    admin_email = Column(String(255), nullable=False)
    # 'my_customer' works for most; set to C-prefix ID if needed
    customer_id = Column(String(100), nullable=False, default="my_customer")
    device_replacement_cost = Column(Numeric(10, 2), nullable=False, default=Decimal("299.00"))
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text)
    created_at = Column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    last_synced_at = Column(DateTime(timezone=True))
    last_sync_status = Column(String(50), default="never")

    devices = relationship("Device", back_populates="tenant", cascade="all, delete-orphan")
    sync_logs = relationship("SyncLog", back_populates="tenant", cascade="all, delete-orphan")


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (UniqueConstraint("tenant_id", "device_id", name="uq_tenant_device"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    device_id = Column(String(255), nullable=False)          # Google's deviceId
    serial_number = Column(String(255), index=True)
    model = Column(String(255))
    org_unit_path = Column(String(512))
    status = Column(String(50), index=True)                  # ACTIVE, DEPROVISIONED, DISABLED
    auto_update_expiration = Column(DateTime(timezone=True), index=True)
    last_enrolled_time = Column(DateTime(timezone=True))
    last_sync = Column(DateTime(timezone=True))
    os_version = Column(String(100))
    annotated_user = Column(String(255))
    annotated_location = Column(String(255))
    annotated_asset_id = Column(String(255))
    created_at = Column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    tenant = relationship("Tenant", back_populates="devices")


class Suggestion(Base):
    __tablename__ = "suggestions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False, default="Other")
    description = Column(Text)
    submitted_by = Column(String(100))
    status = Column(String(50), nullable=False, default="new")  # new, reviewing, planned, done, declined
    created_at = Column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    started_at = Column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    completed_at = Column(DateTime(timezone=True))
    status = Column(String(50), nullable=False, default="running")  # running, success, failed
    devices_synced = Column(Integer, default=0)
    error_message = Column(Text)

    tenant = relationship("Tenant", back_populates="sync_logs")
