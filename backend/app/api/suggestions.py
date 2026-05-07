from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Suggestion
from app.schemas import SuggestionCreate, SuggestionOut

router = APIRouter(prefix="/suggestions", tags=["suggestions"])


@router.get("", response_model=list[SuggestionOut])
async def list_suggestions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Suggestion).order_by(Suggestion.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=SuggestionOut, status_code=201)
async def create_suggestion(body: SuggestionCreate, db: AsyncSession = Depends(get_db)):
    suggestion = Suggestion(**body.model_dump())
    db.add(suggestion)
    await db.commit()
    await db.refresh(suggestion)
    return suggestion
