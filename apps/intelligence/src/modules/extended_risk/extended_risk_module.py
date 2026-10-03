from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.extended_risk.controllers.extended_risk_controller import ExtendedRiskController
from src.modules.extended_risk.queries.score_extended_risk_subject.score_extended_risk_subject_handler import (
    ScoreExtendedRiskSubjectHandler,
)
from src.modules.extended_risk.routes.extended_risk_routes import build_extended_risk_router


class ExtendedRiskModule:
    module_id = "extended_risk"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(ScoreExtendedRiskSubjectHandler(container.extended_risk_scoring_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        controller = ExtendedRiskController(container.query_bus, container.settings.request_deadline_seconds)
        return build_extended_risk_router(controller)
