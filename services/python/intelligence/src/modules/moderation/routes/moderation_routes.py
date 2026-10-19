from fastapi import APIRouter

from src.modules.child_safety.dtos.child_safety_dto import MediaScanResponse
from src.modules.content_scoring.dtos.content_score_dto import ImageModerationResponse
from src.modules.moderation.controllers.moderation_controller import ModerationController
from src.modules.moderation.dtos.content_moderation_dto import ContentModerationResponse


def build_moderation_router(controller: ModerationController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["moderation"])
    router.add_api_route(
        "/moderation/classify", controller.classify_content, methods=["POST"], response_model=ContentModerationResponse
    )
    router.add_api_route(
        "/moderation/classify-image",
        controller.classify_image,
        methods=["POST"],
        response_model=ImageModerationResponse,
    )
    router.add_api_route(
        "/moderation/scan-media", controller.scan_media, methods=["POST"], response_model=MediaScanResponse
    )
    return router
