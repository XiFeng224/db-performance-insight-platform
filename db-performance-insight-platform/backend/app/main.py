import sys
import codecs

# 修复编码问题
if sys.stdout.encoding != 'utf-8':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

from fastapi import FastAPI, Request, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from prometheus_fastapi_instrumentator import Instrumentator
from app.config import settings
from app.database import init_db
from app.api import slow_queries, execution_plans, optimization, metrics, flamegraph, config, export, scoring, ai, alerts, comparison, ops, tickets, duty, knowledge, assistant
from app.utils.logger import logger

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(slow_queries.router)
app.include_router(execution_plans.router)
app.include_router(optimization.router)
app.include_router(metrics.router)
app.include_router(flamegraph.router)
app.include_router(config.router)
app.include_router(export.router)
app.include_router(scoring.router)
app.include_router(ai.router)
app.include_router(alerts.router)
app.include_router(comparison.router)
app.include_router(ops.router)
app.include_router(tickets.router)
app.include_router(duty.router)
app.include_router(knowledge.router)
app.include_router(assistant.router)

Instrumentator().instrument(app).expose(app)


def _error_payload(
    code: str,
    message: str,
    context: dict | None = None,
):
    return {
        "detail": {
            "code": code,
            "message": message,
            "context": context or {},
        }
    }


# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_error_payload(
            code="INTERNAL_SERVER_ERROR",
            message="服务器内部错误",
            context={
                "path": request.url.path,
                "method": request.method,
                "debug_error": str(exc) if settings.debug else None,
            },
        ),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.warning(f"HTTP exception {exc.status_code}: {exc.detail}")
    detail_message = exc.detail if isinstance(exc.detail, str) else "请求失败"
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload(
            code=f"HTTP_{exc.status_code}",
            message=detail_message,
            context={
                "path": request.url.path,
                "method": request.method,
            },
        ),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_error_payload(
            code="VALIDATION_ERROR",
            message="请求参数验证失败",
            context={
                "path": request.url.path,
                "method": request.method,
                "errors": exc.errors(),
            },
        ),
    )


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"{request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response


@app.on_event("startup")
async def startup_event():
    logger.info("Starting application...")
    await init_db()
    logger.info("Application started successfully")


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
