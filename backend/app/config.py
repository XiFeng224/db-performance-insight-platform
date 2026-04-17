from pydantic_settings import BaseSettings
from typing import Optional, List
import os


class Settings(BaseSettings):
    app_name: str = "智值守 - 校园实验室智能应急协作平台"
    app_version: str = "1.0.0"
    debug: bool = True
    
    database_url: str = "sqlite+aiosqlite:///./data/platform.db"
    
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str = "root"
    mysql_password: str = "password"
    mysql_database: str = "test"
    
    prometheus_url: str = "http://localhost:9090"
    prometheus_enabled: bool = True
    
    slow_query_threshold: float = 1.0
    
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"]
    
    # 新增配置
    data_dir: str = "./data"
    log_dir: str = "./logs"
    
    # 导出配置
    export_enabled: bool = True
    export_max_records: int = 10000

    # 告警配置
    alert_enabled: bool = True
    alert_thresholds: dict = {
        "slow_query": 10,
        "connection_count": 100,
        "qps": 10000
    }

    # 大模型配置（千问）
    llm_enabled: bool = False
    qwen_api_key: Optional[str] = None
    qwen_base_url: str = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
    qwen_model: str = "qwen-plus"
    qwen_timeout_seconds: int = 20
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# 确保数据目录存在
def ensure_directories():
    for dir_path in [settings.data_dir, settings.log_dir]:
        os.makedirs(dir_path, exist_ok=True)


# 初始化目录
ensure_directories()
