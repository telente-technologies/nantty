from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.chat_spam.controllers.chat_spam_controller import ChatSpamController
from src.modules.chat_spam.queries.score_chat_spam.score_chat_spam_handler import ScoreChatSpamHandler
from src.modules.chat_spam.routes.chat_spam_routes import build_chat_spam_router


class ChatSpamModule:
    module_id = "chat_spam"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(ScoreChatSpamHandler(container.chat_spam_scoring_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        controller = ChatSpamController(container.query_bus, container.settings.request_deadline_seconds)
        return build_chat_spam_router(controller)
