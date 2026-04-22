import httpx
import asyncio

async def test():
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get('http://localhost:8000/api/assistant/qwen-test')
            print(f"Status: {r.status_code}")
            print(f"Response: {r.json()}")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test())