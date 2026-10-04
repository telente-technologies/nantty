from src.interfaces.cqrs_interface import QueryHandler
from src.modules.help_content.dtos.help_answer_draft_dto import HelpAnswerDraftResponse
from src.modules.help_content.queries.draft_help_answer.draft_help_answer_query import DraftHelpAnswerQuery
from src.modules.help_content.services.help_answer_drafting_service import HelpAnswerDraftingService


class DraftHelpAnswerHandler(QueryHandler[DraftHelpAnswerQuery, HelpAnswerDraftResponse]):
    query_type = "helpContent.draftHelpAnswer"

    def __init__(self, drafting_service: HelpAnswerDraftingService) -> None:
        self.drafting_service = drafting_service

    async def execute(self, query: DraftHelpAnswerQuery) -> HelpAnswerDraftResponse:
        return await self.drafting_service.draft(query.request)
