from src.interfaces.cqrs_interface import QueryHandler
from src.modules.bot_detection.dtos.bot_detection_dto import BotScoreResponse
from src.modules.bot_detection.queries.score_bot_likelihood.score_bot_likelihood_query import ScoreBotLikelihoodQuery
from src.modules.bot_detection.services.bot_scoring_service import BotScoringService


class ScoreBotLikelihoodHandler(QueryHandler[ScoreBotLikelihoodQuery, BotScoreResponse]):
    query_type = "botDetection.scoreBotLikelihood"

    def __init__(self, service: BotScoringService) -> None:
        self.service = service

    async def execute(self, query: ScoreBotLikelihoodQuery) -> BotScoreResponse:
        return await self.service.score_bot_likelihood(query.request)
