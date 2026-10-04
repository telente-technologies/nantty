from src.modules.help_content.dtos.help_answer_draft_dto import HelpAnswerDraftRequest, HelpAnswerDraftResponse
from src.modules.help_content.queries.draft_help_answer.draft_help_answer_query import DraftHelpAnswerQuery
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class HelpContentController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def draft_help_answer(self, request: HelpAnswerDraftRequest) -> HelpAnswerDraftResponse:
        response: HelpAnswerDraftResponse = await run_within_request_deadline(
            self.query_bus.execute(DraftHelpAnswerQuery(request)), self.deadline_seconds
        )
        return response
