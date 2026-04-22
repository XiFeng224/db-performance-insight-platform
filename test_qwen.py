import requests
import json

# 测试大模型API
url = "http://localhost:8000/api/assistant/qwen-test"

try:
    response = requests.get(url, timeout=30)
    print(f"状态码: {response.status_code}")
    print(f"响应内容: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
except Exception as e:
    print(f"请求失败: {e}")