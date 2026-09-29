import asyncio
from collections.abc import Awaitable
from typing import Annotated

from fastapi import Depends, HTTPException, Request

from app.core.application_container import ApplicationContainer


def get_application_container(request: Request) -> ApplicationContainer:
    container: ApplicationContainer = request.app.state.container
    return container


ContainerDependency = Annotated[ApplicationContainer, Depends(get_application_container)]


async def run_within_request_deadline[ResultType](
    operation: Awaitable[ResultType], container: ApplicationContainer, deadline_seconds: float | None = None
) -> ResultType:
    try:
        async with asyncio.timeout(deadline_seconds or container.settings.request_deadline_seconds):
            return await operation
    except TimeoutError as deadline_error:
        raise HTTPException(status_code=503, detail="deadline_exceeded") from deadline_error
