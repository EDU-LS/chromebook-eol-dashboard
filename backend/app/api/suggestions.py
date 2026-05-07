from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.audit import write_audit
from app.auth import get_current_user
from app.database import get_db
from app.models import Suggestion, SuggestionComment
from app.schemas import CommentCreate, CommentOut, SuggestionCreate, SuggestionOut

router = APIRouter(prefix="/suggestions", tags=["suggestions"])

VALID_STATUSES = {"pending", "to_be_discussed", "complete"}


@router.get("", response_model=list[SuggestionOut])
async def list_suggestions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Suggestion)
        .options(selectinload(Suggestion.comments))
        .order_by(Suggestion.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=SuggestionOut, status_code=201)
async def create_suggestion(
    body: SuggestionCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    suggestion = Suggestion(**body.model_dump(), status="pending")
    db.add(suggestion)
    await db.commit()
    await db.refresh(suggestion, ["comments"])
    await write_audit(
        db, current_user, "suggestion_created",
        f"Posted idea: \"{suggestion.title}\"",
        request.client.host if request.client else None,
    )
    return suggestion


@router.patch("/{suggestion_id}/status", response_model=SuggestionOut)
async def update_status(
    suggestion_id: str,
    payload: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    new_status = payload.get("status", "")
    if new_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}")
    result = await db.execute(
        select(Suggestion)
        .options(selectinload(Suggestion.comments))
        .where(Suggestion.id == suggestion_id)
    )
    suggestion = result.scalar_one_or_none()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    old_status = suggestion.status
    suggestion.status = new_status
    await db.commit()
    await db.refresh(suggestion, ["comments"])
    await write_audit(
        db, current_user, "suggestion_status_changed",
        f"\"{suggestion.title}\" → {new_status} (was {old_status})",
        request.client.host if request.client else None,
    )
    return suggestion


@router.post("/{suggestion_id}/comments", response_model=CommentOut, status_code=201)
async def add_comment(
    suggestion_id: str,
    body: CommentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    result = await db.execute(
        select(Suggestion).where(Suggestion.id == suggestion_id)
    )
    suggestion = result.scalar_one_or_none()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    comment = SuggestionComment(suggestion_id=suggestion_id, **body.model_dump())
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    await write_audit(
        db, current_user, "comment_added",
        f"Replied to: \"{suggestion.title}\"",
        request.client.host if request.client else None,
    )
    return comment
