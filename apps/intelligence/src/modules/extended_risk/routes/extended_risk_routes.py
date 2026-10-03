from fastapi import APIRouter

from src.modules.extended_risk.controllers.extended_risk_controller import ExtendedRiskController
from src.modules.extended_risk.dtos.extended_risk_dto import ExtendedRiskResponse


def build_extended_risk_router(controller: ExtendedRiskController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["risk"])
    router.add_api_route(
        "/risk/score-extended",
        controller.score_extended_risk_subject,
        methods=["POST"],
        response_model=ExtendedRiskResponse,
    )
    return router
