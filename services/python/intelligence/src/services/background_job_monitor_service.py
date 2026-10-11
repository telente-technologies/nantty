import asyncio


class BackgroundJobMonitor:
    def __init__(self) -> None:
        self._jobs: dict[str, asyncio.Task[None]] = {}

    def track(self, job_name: str, task: asyncio.Task[None]) -> None:
        self._jobs[job_name] = task

    def forget_all(self) -> None:
        self._jobs = {}

    def dead_job_names(self) -> list[str]:
        return sorted(name for name, task in self._jobs.items() if task.done() and not task.cancelled())
