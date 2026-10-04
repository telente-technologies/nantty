import asyncio
from collections.abc import Awaitable

from fastapi import HTTPException


async def run_within_request_deadline[ResultType](
    operation: Awaitable[ResultType], deadline_seconds: float
) -> ResultType:
    try:
        async with asyncio.timeout(deadline_seconds):
            return await operation
    except TimeoutError as deadline_error:
        raise HTTPException(status_code=503, detail="deadline_exceeded") from deadline_error
