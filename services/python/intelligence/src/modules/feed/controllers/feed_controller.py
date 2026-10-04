from src.modules.feed.dtos.feed_ranking_dto import FeedRankingRequest, FeedRankingResponse
from src.modules.feed.queries.rank_feed_candidates.rank_feed_candidates_query import RankFeedCandidatesQuery
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class FeedController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def rank_feed(self, request: FeedRankingRequest) -> FeedRankingResponse:
        response: FeedRankingResponse = await run_within_request_deadline(
            self.query_bus.execute(RankFeedCandidatesQuery(request)), self.deadline_seconds
        )
        return response
