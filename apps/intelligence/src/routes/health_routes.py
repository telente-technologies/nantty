from fastapi import APIRouter

from src.controllers.health_controller import HealthController


def build_health_router(controller: HealthController) -> APIRouter:
    router = APIRouter(prefix="/health", tags=["health"])
    router.add_api_route("/live", controller.report_liveness, methods=["GET"])
    router.add_api_route("/ready", controller.report_readiness, methods=["GET"])
    return router
