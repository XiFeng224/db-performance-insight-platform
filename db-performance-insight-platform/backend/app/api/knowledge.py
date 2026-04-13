from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.database import KnowledgeArticle

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


class KnowledgeCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    keywords: Optional[str] = None
    content: str = Field(..., min_length=2)
    category: str = Field(default="general", max_length=50)


@router.get("/")
async def list_articles(q: Optional[str] = None, limit: int = 20, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    stmt = select(KnowledgeArticle).order_by(desc(KnowledgeArticle.solve_count), desc(KnowledgeArticle.view_count)).limit(max(1, min(limit, 200)))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(KnowledgeArticle.title.like(like), KnowledgeArticle.keywords.like(like), KnowledgeArticle.content.like(like)))

    rows = (await db.execute(stmt)).scalars().all()
    return {"items": [r.to_dict() for r in rows], "count": len(rows)}


@router.post("/")
async def create_article(payload: KnowledgeCreate, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    article = KnowledgeArticle(
        title=payload.title,
        keywords=payload.keywords,
        content=payload.content,
        category=payload.category,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return {"item": article.to_dict()}


@router.post("/{article_id}/view")
async def mark_view(article_id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    row = (await db.execute(select(KnowledgeArticle).where(KnowledgeArticle.id == article_id))).scalar_one_or_none()
    if not row:
        return {"ok": False}
    row.view_count += 1
    row.updated_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}


@router.post("/{article_id}/solve")
async def mark_solve(article_id: int, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    row = (await db.execute(select(KnowledgeArticle).where(KnowledgeArticle.id == article_id))).scalar_one_or_none()
    if not row:
        return {"ok": False}
    row.solve_count += 1
    row.updated_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}
