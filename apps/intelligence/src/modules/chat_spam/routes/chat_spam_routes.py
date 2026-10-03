from fastapi import APIRouter

from src.modules.chat_spam.controllers.chat_spam_controller import ChatSpamController
from src.modules.chat_spam.dtos.chat_spam_dto import ChatSpamResponse


def build_chat_spam_router(controller: ChatSpamController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["chat_spam"])
    router.add_api_route(
        "/chat/spam-score", controller.score_chat_spam, methods=["POST"], response_model=ChatSpamResponse
    )
    return router
