from src.interfaces.cqrs_interface import QueryHandler
from src.modules.recommendations.queries.recall_product_candidates.recall_product_candidates_query import (
    RecallProductCandidatesQuery,
)
from src.modules.recommendations.services.product_recommendation_service import ProductRecommendationService


class RecallProductCandidatesHandler(QueryHandler[RecallProductCandidatesQuery, list[str]]):
    query_type = "recommendations.recallProductCandidates"

    def __init__(self, product_recommendation_service: ProductRecommendationService) -> None:
        self.product_recommendation_service = product_recommendation_service

    async def execute(self, query: RecallProductCandidatesQuery) -> list[str]:
        return await self.product_recommendation_service.recall_product_candidates(query.request)
