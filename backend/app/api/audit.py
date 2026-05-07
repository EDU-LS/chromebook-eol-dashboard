from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import AuditLog
from app.schemas import AuditLogOut

router = APIRouter(prefix="/audit", tags=["audit"])

AUDIT_ALLOWED_USERS = {"LSpencer"}


def require_audit_access(current_user: str = Depends(get_current_user)) -> str:
    if current_user not in AUDIT_ALLOWED_USERS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted",
        )
    return current_user


@router.get("", response_model=list[AuditLogOut])
async def get_audit_logs(
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_audit_access),
):
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    )
    return result.scalars().all()
