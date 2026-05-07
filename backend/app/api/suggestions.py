from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
async def create_suggestion(body: SuggestionCreate, db: AsyncSession = Depends(get_db)):
    suggestion = Suggestion(**body.model_dump(), status="pending")
    db.add(suggestion)
    await db.commit()
    await db.refresh(suggestion, ["comments"])
    return suggestion


@router.patch("/{suggestion_id}/status", response_model=SuggestionOut)
async def update_status(suggestion_id: str, payload: dict, db: AsyncSession = Depends(get_db)):
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
    suggestion.status = new_status
    await db.commit()
    await db.refresh(suggestion, ["comments"])
    return suggestion


@router.post("/{suggestion_id}/comments", response_model=CommentOut, status_code=201)
async def add_comment(suggestion_id: str, body: CommentCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Suggestion).where(Suggestion.id == suggestion_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Suggestion not found")
    comment = SuggestionComment(suggestion_id=suggestion_id, **body.model_dump())
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment
