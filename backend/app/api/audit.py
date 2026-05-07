from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import write_audit
from app.auth import get_current_user
from app.database import get_db
from app.models import AuditLog
from app.schemas import AuditLogOut

router = APIRouter(prefix="/audit", tags=["audit"])

AUDIT_ALLOWED_USERS = {"LSpencer"}

ALLOWED_CLIENT_ACTIONS = {
    "dashboard_view", "tenant_view",
    "csv_export_all", "csv_export_tenant",
}


def require_audit_access(current_user: str = Depends(get_current_user)) -> str:
    if current_user not in AUDIT_ALLOWED_USERS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access restricted")
    return current_user


class ClientLogBody(BaseModel):
    action: str
    detail: str | None = None


@router.post("/log", status_code=status.HTTP_204_NO_CONTENT)
async def log_client_event(
    body: ClientLogBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """Endpoint for frontend to log client-side events (page views, CSV exports)."""
    if body.action not in ALLOWED_CLIENT_ACTIONS:
        raise HTTPException(status_code=400, detail="Unknown action")
    await write_audit(
        db, current_user, body.action, body.detail,
        request.client.host if request.client else None,
    )


@router.get("", response_model=list[AuditLogOut])
async def get_audit_logs(
    limit: int = 500,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_audit_access),
):
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    )
    return result.scalars().all()
