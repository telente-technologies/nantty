from src.modules.bot_detection.dtos.bot_detection_dto import BotScoreRequest, BotScoreResponse
from src.modules.bot_detection.queries.score_bot_likelihood.score_bot_likelihood_query import ScoreBotLikelihoodQuery
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class BotDetectionController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def score_bot_likelihood(self, request: BotScoreRequest) -> BotScoreResponse:
        response: BotScoreResponse = await run_within_request_deadline(
            self.query_bus.execute(ScoreBotLikelihoodQuery(request)), self.deadline_seconds
        )
        return response
