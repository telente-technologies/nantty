from src.modules.clips.dtos.clip_ranking_dto import ClipRankingRequest, ClipRankingResponse
from src.modules.clips.queries.rank_clip_candidates.rank_clip_candidates_query import RankClipCandidatesQuery
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class ClipsController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def rank_clips(self, request: ClipRankingRequest) -> ClipRankingResponse:
        response: ClipRankingResponse = await run_within_request_deadline(
            self.query_bus.execute(RankClipCandidatesQuery(request)), self.deadline_seconds
        )
        return response
