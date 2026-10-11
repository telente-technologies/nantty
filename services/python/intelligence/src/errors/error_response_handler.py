import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

error_logger = logging.getLogger("intelligence.errors")
MAXIMUM_REPORTED_INVALID_FIELDS = 20


async def respond_to_validation_error(_request: Request, error: Exception) -> JSONResponse:
    field_locations: list[str] = []
    if isinstance(error, RequestValidationError):
        field_locations = [".".join(str(part) for part in item.get("loc", ())) for item in error.errors()]
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "invalid_request", "fields": field_locations[:MAXIMUM_REPORTED_INVALID_FIELDS]}},
    )


async def respond_to_http_error(_request: Request, error: Exception) -> JSONResponse:
    status_code = error.status_code if isinstance(error, HTTPException) else 500
    detail = error.detail if isinstance(error, HTTPException) else "internal_error"
    headers = error.headers if isinstance(error, HTTPException) else None
    return JSONResponse(status_code=status_code, content={"error": {"code": str(detail)}}, headers=headers)


async def respond_to_unexpected_error(request: Request, error: Exception) -> JSONResponse:
    error_logger.exception(
        "unhandled_error",
        extra={
            "error_type": type(error).__name__,
            "method": request.method,
            "path": request.url.path,
        },
    )
    return JSONResponse(status_code=500, content={"error": {"code": "internal_error"}})


def register_error_response_handlers(application: FastAPI) -> None:
    application.add_exception_handler(RequestValidationError, respond_to_validation_error)
    application.add_exception_handler(HTTPException, respond_to_http_error)
    application.add_exception_handler(Exception, respond_to_unexpected_error)
