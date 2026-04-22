import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings
print(f"Database URL: {settings.database_url}")
print(f"Database path: {settings.database_url.replace('sqlite+aiosqlite:///', '')}")