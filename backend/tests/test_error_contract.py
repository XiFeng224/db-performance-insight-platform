from fastapi import HTTPException

from app.main import _error_payload


def test_error_payload_contract() -> None:
    payload = _error_payload(
        code="VALIDATION_ERROR",
        message="请求参数验证失败",
        context={"path": "/api/test", "method": "GET"},
    )

    assert "detail" in payload
    assert payload["detail"]["code"] == "VALIDATION_ERROR"
    assert payload["detail"]["message"] == "请求参数验证失败"
    assert payload["detail"]["context"]["path"] == "/api/test"


def test_error_payload_context_default() -> None:
    payload = _error_payload(code="HTTP_400", message="bad request")
    assert payload["detail"]["context"] == {}
