import logging
import math
import time

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from src.utils.asgi_response_util import send_json_error_response
from src.utils.token_bucket_rate_limiter_util import TokenBucketRateLimiter

access_logger = logging.getLogger("intelligence.access")


class RateLimitMiddleware:
    def __init__(self, application: ASGIApp, rate_limiter: TokenBucketRateLimiter) -> None:
        self.application = application
        self.rate_limiter = rate_limiter

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.application(scope, receive, send)
            return
        client = scope.get("client")
        client_key = str(client[0]) if client else "unknown"
        allowed, retry_after_seconds = self.rate_limiter.try_consume_token(client_key)
        if not allowed:
            retry_after_header = str(max(math.ceil(retry_after_seconds), 1)).encode("ascii")
            await send_json_error_response(send, 429, "rate_limited", [(b"retry-after", retry_after_header)])
            return
        await self.application(scope, receive, send)


class AccessLogMiddleware:
    def __init__(self, application: ASGIApp) -> None:
        self.application = application

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.application(scope, receive, send)
            return
        started_at = time.perf_counter()
        response_status = 500

        async def send_and_capture_status(message: Message) -> None:
            nonlocal response_status
            if message["type"] == "http.response.start":
                response_status = int(message["status"])
            await send(message)

        try:
            await self.application(scope, receive, send_and_capture_status)
        finally:
            access_logger.info(
                "request_completed",
                extra={
                    "method": scope["method"],
                    "path": scope["path"],
                    "status": response_status,
                    "duration_ms": round((time.perf_counter() - started_at) * 1000, 2),
                },
            )
