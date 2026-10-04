from src.interfaces.cqrs_interface import QueryHandler
from src.modules.feed.dtos.feed_ranking_dto import FeedRankingResponse
from src.modules.feed.queries.rank_feed_candidates.rank_feed_candidates_query import RankFeedCandidatesQuery
from src.modules.feed.services.feed_ranking_service import FeedRankingService


class RankFeedCandidatesHandler(QueryHandler[RankFeedCandidatesQuery, FeedRankingResponse]):
    query_type = "feed.rankFeedCandidates"

    def __init__(self, feed_ranking_service: FeedRankingService) -> None:
        self.feed_ranking_service = feed_ranking_service

    async def execute(self, query: RankFeedCandidatesQuery) -> FeedRankingResponse:
        return await self.feed_ranking_service.rank_feed(query.request)
