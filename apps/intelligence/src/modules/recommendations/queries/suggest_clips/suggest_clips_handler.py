from src.interfaces.cqrs_interface import QueryHandler
from src.modules.recommendations.dtos.recommendation_dto import RecommendationResponse
from src.modules.recommendations.queries.suggest_clips.suggest_clips_query import SuggestClipsQuery
from src.modules.recommendations.services.account_and_clip_recommendation_service import (
    AccountAndClipRecommendationService,
)


class SuggestClipsHandler(QueryHandler[SuggestClipsQuery, RecommendationResponse]):
    query_type = "recommendations.suggestClips"

    def __init__(self, account_and_clip_recommendation_service: AccountAndClipRecommendationService) -> None:
        self.account_and_clip_recommendation_service = account_and_clip_recommendation_service

    async def execute(self, query: SuggestClipsQuery) -> RecommendationResponse:
        return await self.account_and_clip_recommendation_service.suggest_clips(query.request)
