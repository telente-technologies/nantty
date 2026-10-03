from src.interfaces.cqrs_interface import QueryHandler
from src.modules.chat_spam.dtos.chat_spam_dto import ChatSpamResponse
from src.modules.chat_spam.queries.score_chat_spam.score_chat_spam_query import ScoreChatSpamQuery
from src.modules.chat_spam.services.chat_spam_scoring_service import ChatSpamScoringService


class ScoreChatSpamHandler(QueryHandler[ScoreChatSpamQuery, ChatSpamResponse]):
    query_type = "chatSpam.scoreChatSpam"

    def __init__(self, service: ChatSpamScoringService) -> None:
        self.service = service

    async def execute(self, query: ScoreChatSpamQuery) -> ChatSpamResponse:
        return await self.service.score_chat_spam(query.request)
