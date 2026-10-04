from fastapi import APIRouter

from src.modules.bot_detection.controllers.bot_detection_controller import BotDetectionController
from src.modules.bot_detection.dtos.bot_detection_dto import BotScoreResponse


def build_bot_detection_router(controller: BotDetectionController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["bot_detection"])
    router.add_api_route(
        "/trust/bot-score", controller.score_bot_likelihood, methods=["POST"], response_model=BotScoreResponse
    )
    return router
