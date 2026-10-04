from fastapi import APIRouter

from src.modules.help_content.controllers.help_content_controller import HelpContentController
from src.modules.help_content.dtos.help_answer_draft_dto import HelpAnswerDraftResponse


def build_help_content_router(controller: HelpContentController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["help"])
    router.add_api_route(
        "/help/answer-drafts", controller.draft_help_answer, methods=["POST"], response_model=HelpAnswerDraftResponse
    )
    return router
