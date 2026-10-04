from src.modules.chat_spam.dtos.chat_spam_dto import ChatSpamRequest, ChatSpamResponse
from src.modules.chat_spam.queries.score_chat_spam.score_chat_spam_query import ScoreChatSpamQuery
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class ChatSpamController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def score_chat_spam(self, request: ChatSpamRequest) -> ChatSpamResponse:
        response: ChatSpamResponse = await run_within_request_deadline(
            self.query_bus.execute(ScoreChatSpamQuery(request)), self.deadline_seconds
        )
        return response
