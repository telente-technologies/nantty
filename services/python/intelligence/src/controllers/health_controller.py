import logging

from fastapi.responses import JSONResponse

from src.interfaces.feature_backend_interface import FeatureBackend
from src.services.background_job_monitor_service import BackgroundJobMonitor

health_logger = logging.getLogger("intelligence.health")


class HealthController:
    def __init__(self, feature_backend: FeatureBackend, job_monitor: BackgroundJobMonitor | None = None) -> None:
        self.feature_backend = feature_backend
        self.job_monitor = job_monitor or BackgroundJobMonitor()

    async def report_liveness(self) -> dict[str, str]:
        return {"status": "ok"}

    async def report_readiness(self) -> JSONResponse:
        feature_store_reachable = await self.feature_backend.check_backend_is_reachable()
        dead_jobs = self.job_monitor.dead_job_names()
        if dead_jobs:
            health_logger.error("background_jobs_dead", extra={"job_names": ",".join(dead_jobs)})
        ready = feature_store_reachable and not dead_jobs
        return JSONResponse(
            status_code=200 if ready else 503,
            content={"status": "ready" if ready else "degraded"},
        )
