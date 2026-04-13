from fastapi import APIRouter, Depends
from app.config import settings
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/api/config", tags=["config"])


class ConfigUpdate(BaseModel):
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str = "root"
    mysql_password: str = "password"
    mysql_database: str = "test"
    prometheus_enabled: bool = True
    prometheus_url: str = "http://localhost:9090"
    slow_query_threshold: float = 1.0
    debug: bool = True
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:5173"]


class ConfigResponse(BaseModel):
    app_name: str
    app_version: str
    debug: bool
    mysql_host: str
    mysql_port: int
    mysql_user: str
    mysql_password: str
    mysql_database: str
    prometheus_url: str
    prometheus_enabled: bool
    slow_query_threshold: float
    cors_origins: List[str]


@router.get("/", response_model=ConfigResponse)
async def get_config():
    return ConfigResponse(
        app_name=settings.app_name,
        app_version=settings.app_version,
        debug=settings.debug,
        mysql_host=settings.mysql_host,
        mysql_port=settings.mysql_port,
        mysql_user=settings.mysql_user,
        mysql_password=settings.mysql_password,
        mysql_database=settings.mysql_database,
        prometheus_url=settings.prometheus_url,
        prometheus_enabled=settings.prometheus_enabled,
        slow_query_threshold=settings.slow_query_threshold,
        cors_origins=settings.cors_origins
    )


@router.post("/update")
async def update_config(config: ConfigUpdate):
    # 这里应该实现配置更新逻辑
    # 暂时返回成功
    return {
        "status": "success",
        "message": "配置已更新",
        "data": config.dict()
    }


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "services": {
            "backend": "running",
            "prometheus": "enabled" if settings.prometheus_enabled else "disabled"
        }
    }
