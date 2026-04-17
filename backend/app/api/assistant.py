from datetime import datetime
from time import perf_counter
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.database import AICallLog, KnowledgeArticle
from app.services.qwen_service import QwenService

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class IntakeRequest(BaseModel):
    text: str = Field(..., min_length=2, max_length=2000)
    mode: str = Field(default="auto")  # auto | rule | llm


class HandoverRequest(BaseModel):
    shift_name: str = Field(default="白班")
    unresolved_tickets: List[str] = []
    incidents: List[str] = []


def _severity_from_text(text: str) -> str:
    high_keywords = ["宕机", "中断", "全班", "无法上课", "全部离线", "严重"]
    medium_keywords = ["缓慢", "间歇", "频繁", "异常"]
    if any(k in text for k in high_keywords):
        return "high"
    if any(k in text for k in medium_keywords):
        return "medium"
    return "low"


def _category_from_text(text: str) -> str:
    mapping = {
        "teaching_support": ["课堂", "教室", "授课", "投影"],
        "lab_support": ["机房", "实验室", "交换机", "数据库", "网络"],
        "club_support": ["社团", "活动", "路演", "直播"],
    }
    for cat, kws in mapping.items():
        if any(k in text for k in kws):
            return cat
    return "lab_support"


async def _append_ai_log(
    db: AsyncSession,
    *,
    scene: str,
    engine: str,
    source: str,
    fallback: bool,
    latency_ms: int,
    success: bool,
    message: str | None = None,
):
    db.add(
        AICallLog(
            scene=scene,
            engine=engine,
            source=source,
            fallback=fallback,
            latency_ms=latency_ms,
            success=success,
            message=message,
            created_at=datetime.utcnow(),
        )
    )
    await db.commit()


def _fallback_answer() -> str:
    return (
        "未在本地知识库命中完全答案。建议先执行：\n"
        "1) 确认影响范围（单机/整排/全实验室）\n"
        "2) 拍照并记录报错信息\n"
        "3) 立即创建工单并标注地点/设备\n"
        "4) 若影响上课，升级为高优先级并通知值班组长"
    )


@router.post("/chat")
async def assistant_chat(payload: ChatRequest, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    started = perf_counter()
    q = payload.message.strip()
    like = f"%{q}%"
    rows = (
        await db.execute(
            select(KnowledgeArticle)
            .where(
                or_(
                    KnowledgeArticle.title.like(like),
                    KnowledgeArticle.keywords.like(like),
                    KnowledgeArticle.content.like(like),
                )
            )
            .limit(3)
        )
    ).scalars().all()
    refs = [r.to_dict() for r in rows]

    engine = "rule"
    source = "fallback_guide"
    fallback = True
    success = True
    err_msg = None
    answer = _fallback_answer()

    try:
        if rows:
            kb_text = "\n\n".join([f"【{r.title}】{r.content}" for r in rows])
            llm_answer = await QwenService.chat_answer(
                f"你是校园值班助手。请基于以下知识库内容优先回答，并补充可执行步骤：\n{kb_text}\n\n用户问题：{q}"
            )
            if llm_answer:
                answer = llm_answer
                source = "qwen_with_kb"
                engine = "qwen"
                fallback = False
            else:
                answer = kb_text
                source = "knowledge_base"
                engine = "rule"
                fallback = True
        else:
            llm_answer = await QwenService.chat_answer(
                "你是校园值班助手，请用中文给出清晰的应急处置步骤。用户问题：" + q
            )
            if llm_answer:
                answer = llm_answer
                source = "qwen"
                engine = "qwen"
                fallback = False
    except Exception as e:
        answer = _fallback_answer()
        source = "fallback_guide"
        engine = "rule"
        fallback = True
        success = False
        err_msg = str(e)

    latency_ms = int((perf_counter() - started) * 1000)
    await _append_ai_log(
        db,
        scene="chat",
        engine=engine,
        source=source,
        fallback=fallback,
        latency_ms=latency_ms,
        success=success,
        message=err_msg,
    )

    return {
        "answer": answer,
        "source": source,
        "engine": engine,
        "fallback": fallback,
        "latency_ms": latency_ms,
        "references": refs,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/intake")
async def assistant_intake(payload: IntakeRequest, db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    started = perf_counter()
    text = payload.text.strip()
    mode = (payload.mode or "auto").lower()

    severity = _severity_from_text(text)
    category = _category_from_text(text)

    location = None
    if "教" in text and "室" in text:
        location = "教学楼教室"
    elif "机房" in text:
        location = "机房"
    elif "实验室" in text:
        location = "实验室"

    result = {
        "title": text[:40],
        "description": text,
        "category": category,
        "severity": severity,
        "location": location,
        "recommendation": [
            "优先确认影响范围与是否影响教学",
            "若影响上课，立即升级并电话通知值班组长",
            "接单后5分钟内填写ETA",
        ],
        "engine": "rule",
        "source": "rule",
        "mode": mode,
        "fallback": False,
    }

    success = True
    err_msg = None

    if mode in ["llm", "auto"]:
        try:
            enhanced = await QwenService.intake_enhance(text)
            if enhanced:
                result.update(
                    {
                        "title": enhanced.get("title") or result["title"],
                        "description": enhanced.get("summary") or result["description"],
                        "category": enhanced.get("category") or result["category"],
                        "severity": enhanced.get("severity") or result["severity"],
                        "location": enhanced.get("location") or result["location"],
                        "recommendation": enhanced.get("recommendation") or result["recommendation"],
                        "engine": "qwen",
                        "source": "qwen",
                        "fallback": False,
                    }
                )
            else:
                result["engine"] = "rule"
                result["source"] = "rule"
                result["fallback"] = True
        except Exception as e:
            result["engine"] = "rule"
            result["source"] = "rule"
            result["fallback"] = True
            success = False
            err_msg = str(e)

    latency_ms = int((perf_counter() - started) * 1000)
    await _append_ai_log(
        db,
        scene="intake",
        engine=result["engine"],
        source=result["source"],
        fallback=result["fallback"],
        latency_ms=latency_ms,
        success=success,
        message=err_msg,
    )
    result["latency_ms"] = latency_ms
    return result


@router.get("/stats")
async def assistant_stats(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    try:
        rows = (await db.execute(select(AICallLog))).scalars().all()
        if not rows:
            return {
                "count": 0,
                "avg_latency_ms": 0,
                "fallback_rate": 0,
                "engine_distribution": {},
                "scene_distribution": {},
            }

        count = len(rows)
        avg_latency = round(sum(r.latency_ms for r in rows) / count, 2)
        fallback_rate = round(sum(1 for r in rows if r.fallback) / count, 4)

        engine_rows = (await db.execute(select(AICallLog.engine, func.count(AICallLog.id)).group_by(AICallLog.engine))).all()
        scene_rows = (await db.execute(select(AICallLog.scene, func.count(AICallLog.id)).group_by(AICallLog.scene))).all()

        return {
            "count": count,
            "avg_latency_ms": avg_latency,
            "fallback_rate": fallback_rate,
            "engine_distribution": {k: v for k, v in engine_rows},
            "scene_distribution": {k: v for k, v in scene_rows},
        }
    except Exception as exc:
        return {
            "count": 0,
            "avg_latency_ms": 0,
            "fallback_rate": 0,
            "engine_distribution": {},
            "scene_distribution": {},
            "error": str(exc),
        }


@router.get("/qwen-test")
async def qwen_test() -> Dict[str, Any]:
    return await QwenService.test_connection()


@router.post("/handover-summary")
async def handover_summary(payload: HandoverRequest) -> Dict[str, Any]:
    unresolved = payload.unresolved_tickets or []
    incidents = payload.incidents or []

    summary = [
        f"{payload.shift_name}交接摘要",
        f"未完成工单数：{len(unresolved)}",
        f"异常事件数：{len(incidents)}",
        "",
        "【未完成工单】",
        *([f"- {x}" for x in unresolved] or ["- 无"]),
        "",
        "【异常事件】",
        *([f"- {x}" for x in incidents] or ["- 无"]),
        "",
        "【下一班建议】",
        "- 优先处理高优先级且影响教学的工单",
        "- 持续关注待验收工单并及时回访",
        "- 交班前更新ETA与处置进展",
    ]

    return {"summary": "\n".join(summary), "generated_at": datetime.utcnow().isoformat()}
