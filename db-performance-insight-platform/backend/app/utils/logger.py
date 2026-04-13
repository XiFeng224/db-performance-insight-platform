import logging
import os
from app.config import settings
from logging.handlers import RotatingFileHandler

def setup_logger(name: str = "app", log_file: str = None):
    """设置日志记录器"""
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG if settings.debug else logging.INFO)
    
    # 避免重复添加handler
    if logger.handlers:
        return logger
    
    # 控制台输出
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_format = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(console_format)
    logger.addHandler(console_handler)
    
    # 文件输出
    if log_file:
        log_path = os.path.join(settings.log_dir, log_file)
        os.makedirs(settings.log_dir, exist_ok=True)
        file_handler = RotatingFileHandler(
            log_path,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(logging.DEBUG)
        file_format = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s'
        )
        file_handler.setFormatter(file_format)
        logger.addHandler(file_handler)
    
    return logger

# 创建全局日志记录器
logger = setup_logger("app", "app.log")
api_logger = setup_logger("api", "api.log")
