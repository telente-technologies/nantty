from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.help_content.controllers.help_content_controller import HelpContentController
from src.modules.help_content.queries.draft_help_answer.draft_help_answer_handler import DraftHelpAnswerHandler
from src.modules.help_content.routes.help_content_routes import build_help_content_router
from src.modules.help_content.services.help_answer_drafting_service import HelpAnswerDraftingService


class HelpContentModule:
    module_id = "help_content"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(DraftHelpAnswerHandler(HelpAnswerDraftingService()))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        return build_help_content_router(
            HelpContentController(container.query_bus, container.settings.request_deadline_seconds)
        )
