import asyncio
import functools
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor

BACKGROUND_WORK_EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="intelligence-background")


async def run_in_background_executor[ResultType](function: Callable[..., ResultType], *arguments: object) -> ResultType:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(BACKGROUND_WORK_EXECUTOR, functools.partial(function, *arguments))
