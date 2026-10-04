from fastapi.responses import JSONResponse

from src.interfaces.feature_backend_interface import FeatureBackend


class HealthController:
    def __init__(self, feature_backend: FeatureBackend) -> None:
        self.feature_backend = feature_backend

    async def report_liveness(self) -> dict[str, str]:
        return {"status": "ok"}

    async def report_readiness(self) -> JSONResponse:
        feature_store_reachable = await self.feature_backend.check_backend_is_reachable()
        return JSONResponse(
            status_code=200 if feature_store_reachable else 503,
            content={"status": "ready" if feature_store_reachable else "degraded"},
        )
