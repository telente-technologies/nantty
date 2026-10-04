from src.interfaces.cqrs_interface import QueryHandler
from src.modules.recommendations.dtos.recommendation_dto import RecommendationResponse
from src.modules.recommendations.queries.recommend_accounts.recommend_accounts_query import RecommendAccountsQuery
from src.modules.recommendations.services.account_and_clip_recommendation_service import (
    AccountAndClipRecommendationService,
)


class RecommendAccountsHandler(QueryHandler[RecommendAccountsQuery, RecommendationResponse]):
    query_type = "recommendations.recommendAccounts"

    def __init__(self, account_and_clip_recommendation_service: AccountAndClipRecommendationService) -> None:
        self.account_and_clip_recommendation_service = account_and_clip_recommendation_service

    async def execute(self, query: RecommendAccountsQuery) -> RecommendationResponse:
        return await self.account_and_clip_recommendation_service.recommend_accounts(query.request)
