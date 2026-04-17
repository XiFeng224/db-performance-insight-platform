import httpx
from app.config import settings

headers = {
    "Authorization": f"Bearer {settings.qwen_api_key}",
    "Content-Type": "application/json",
}

payload = {
    "model": settings.qwen_model,
    "input": {
        "messages": [
            {"role": "system", "content": "你是校园值班助手"},
            {"role": "user", "content": "请只回复：pong"}
        ]
    },
    "parameters": {
        "result_format": "message",
        "temperature": 0.2,
    },
}

try:
    response = httpx.post(settings.qwen_base_url, headers=headers, json=payload, timeout=20)
    print("Status Code:", response.status_code)
    print("Response:", response.text)
except Exception as e:
    print("Error:", e)
