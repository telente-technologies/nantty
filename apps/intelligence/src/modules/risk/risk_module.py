from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.risk.controllers.risk_controller import RiskController
from src.modules.risk.queries.score_risk_subject.score_risk_subject_handler import ScoreRiskSubjectHandler
from src.modules.risk.routes.risk_routes import build_risk_router


class RiskModule:
    module_id = "risk"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(ScoreRiskSubjectHandler(container.risk_scoring_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        controller = RiskController(container.query_bus, container.settings.request_deadline_seconds)
        return build_risk_router(controller)
