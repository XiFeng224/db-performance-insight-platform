from __future__ import annotations

from typing import Any, Dict, Optional
import json

import httpx

from app.config import settings


class QwenService:
    @staticmethod
    def is_enabled() -> bool:
        return bool(settings.llm_enabled and settings.qwen_api_key)

    @staticmethod
    async def _post_to_qwen(message: str, *, system_prompt: str) -> str:
        headers = {
            "Authorization": f"Bearer {settings.qwen_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.qwen_model,
            "input": {
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message},
                ]
            },
            "parameters": {
                "result_format": "message",
                "temperature": 0.2,
            },
        }

        async with httpx.AsyncClient(timeout=settings.qwen_timeout_seconds) as client:
            resp = await client.post(settings.qwen_base_url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        try:
            return (
                data.get("output", {})
                .get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
        except Exception as exc:
            raise RuntimeError(f"Unexpected Qwen response format: {data}") from exc

    @staticmethod
    def _clean_json_content(content: str) -> str:
        text = content.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:].strip()
        return text

    @staticmethod
    async def chat_answer(message: str) -> Optional[str]:
        if not QwenService.is_enabled():
            return None

        content = await QwenService._post_to_qwen(
            message,
            system_prompt="你是校园值班助手，请给出清晰、可执行的中文建议。",
        )
        return content or None

    @staticmethod
    async def intake_enhance(text: str) -> Optional[Dict[str, Any]]:
        if not QwenService.is_enabled():
            return None

        prompt = (
            "你是校园值班系统的工单受理助手。"
            "请从用户报障文本中提取并返回JSON，字段包括："
            "title, category(teaching_support/lab_support/club_support), severity(high/medium/low), location, summary, recommendation(list<string>)。"
            "只返回JSON，不要输出其他文字。\n"
            f"报障文本：{text}"
        )

        content = await QwenService._post_to_qwen(
            prompt,
            system_prompt="你是可靠的校园值班工单助手",
        )

        if not content:
            return None

        try:
            parsed = json.loads(QwenService._clean_json_content(content))
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None

    @staticmethod
    async def test_connection() -> Dict[str, Any]:
        if not QwenService.is_enabled():
            return {
                "enabled": False,
                "reachable": False,
                "model": settings.qwen_model,
                "message": "LLM 未启用或未配置 API Key",
            }

        try:
            content = await QwenService.chat_answer("请只回复：pong")
            return {
                "enabled": True,
                "reachable": bool(content),
                "model": settings.qwen_model,
                "message": content or "未返回内容",
            }
        except Exception as exc:
            return {
                "enabled": True,
                "reachable": False,
                "model": settings.qwen_model,
                "message": f"{type(exc).__name__}: {exc}",
            }
