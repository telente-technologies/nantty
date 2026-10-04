from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.bot_detection.controllers.bot_detection_controller import BotDetectionController
from src.modules.bot_detection.queries.score_bot_likelihood.score_bot_likelihood_handler import (
    ScoreBotLikelihoodHandler,
)
from src.modules.bot_detection.routes.bot_detection_routes import build_bot_detection_router


class BotDetectionModule:
    module_id = "bot_detection"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(ScoreBotLikelihoodHandler(container.bot_scoring_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        controller = BotDetectionController(container.query_bus, container.settings.request_deadline_seconds)
        return build_bot_detection_router(controller)
