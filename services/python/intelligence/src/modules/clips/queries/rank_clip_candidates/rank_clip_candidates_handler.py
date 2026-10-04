from src.interfaces.cqrs_interface import QueryHandler
from src.modules.clips.dtos.clip_ranking_dto import ClipRankingResponse
from src.modules.clips.queries.rank_clip_candidates.rank_clip_candidates_query import RankClipCandidatesQuery
from src.modules.clips.services.clip_ranking_service import ClipRankingService


class RankClipCandidatesHandler(QueryHandler[RankClipCandidatesQuery, ClipRankingResponse]):
    query_type = "clips.rankClipCandidates"

    def __init__(self, clip_ranking_service: ClipRankingService) -> None:
        self.clip_ranking_service = clip_ranking_service

    async def execute(self, query: RankClipCandidatesQuery) -> ClipRankingResponse:
        return await self.clip_ranking_service.rank_clips(query.request)
