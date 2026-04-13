from __future__ import annotations

from typing import Any, Dict, Optional

import httpx

from app.config import settings


class QwenService:
    @staticmethod
    async def chat_answer(message: str) -> Optional[str]:
        if not settings.llm_enabled or not settings.qwen_api_key:
            return None

        headers = {
            "Authorization": f"Bearer {settings.qwen_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.qwen_model,
            "input": {
                "messages": [
                    {"role": "system", "content": "你是校园值班助手，请给出清晰、可执行的中文建议。"},
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

        content = (
            data.get("output", {})
            .get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )
        return content or None

    @staticmethod
    async def intake_enhance(text: str) -> Optional[Dict[str, Any]]:
        if not settings.llm_enabled or not settings.qwen_api_key:
            return None

        prompt = (
            "你是校园值班系统的工单受理助手。"
            "请从用户报障文本中提取并返回JSON，字段包括："
            "title, category(teaching_support/lab_support/club_support), severity(high/medium/low), location, summary, recommendation(list<string>)。"
            "只返回JSON，不要输出其他文字。\n"
            f"报障文本：{text}"
        )

        headers = {
            "Authorization": f"Bearer {settings.qwen_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": settings.qwen_model,
            "input": {
                "messages": [
                    {"role": "system", "content": "你是可靠的校园值班工单助手"},
                    {"role": "user", "content": prompt},
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

        content = (
            data.get("output", {})
            .get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )

        if not content:
            return None

        # 简单容错：若被 ```json 包裹则去掉
        if content.startswith("```"):
            content = content.strip("`")
            content = content.replace("json", "", 1).strip()

        import json

        try:
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                return parsed
            return None
        except Exception:
            return None
