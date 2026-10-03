from fastapi import APIRouter

from src.modules.moderation.controllers.moderation_controller import ModerationController
from src.modules.moderation.dtos.content_moderation_dto import ContentModerationResponse


def build_moderation_router(controller: ModerationController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["moderation"])
    router.add_api_route(
        "/moderation/classify", controller.classify_content, methods=["POST"], response_model=ContentModerationResponse
    )
    return router
