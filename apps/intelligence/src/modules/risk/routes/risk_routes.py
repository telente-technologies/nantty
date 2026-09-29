from fastapi import APIRouter

from src.modules.risk.controllers.risk_controller import RiskController
from src.modules.risk.dtos.risk_scoring_dto import RiskScoringResponse


def build_risk_router(controller: RiskController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["risk"])
    router.add_api_route("/risk/score", controller.score_risk, methods=["POST"], response_model=RiskScoringResponse)
    return router
