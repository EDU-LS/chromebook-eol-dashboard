"""Audit logging helper — call write_audit() from any endpoint."""

import logging
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import AuditLog

logger = logging.getLogger(__name__)


async def write_audit(
    db: AsyncSession,
    username: str,
    action: str,
    detail: str | None = None,
    ip_address: str | None = None,
):
    try:
        db.add(AuditLog(
            username=username,
            action=action,
            detail=detail,
            ip_address=ip_address,
        ))
        await db.commit()
    except Exception as exc:
        logger.warning("Failed to write audit log: %s", exc)
