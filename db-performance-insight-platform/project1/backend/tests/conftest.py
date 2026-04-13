import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# 确保 pytest 可导入 backend/app 包
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.main import app


def pytest_sessionstart(session):
    """测试会话启动时确保测试数据目录存在。"""
    test_data_dir = Path("./data")
    test_data_dir.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("PYTHONUNBUFFERED", "1")


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)
