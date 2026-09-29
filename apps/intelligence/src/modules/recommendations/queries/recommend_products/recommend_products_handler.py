from src.interfaces.cqrs_interface import QueryHandler
from src.modules.recommendations.dtos.recommendation_dto import RecommendationResponse
from src.modules.recommendations.queries.recommend_products.recommend_products_query import RecommendProductsQuery
from src.modules.recommendations.services.product_recommendation_service import ProductRecommendationService


class RecommendProductsHandler(QueryHandler[RecommendProductsQuery, RecommendationResponse]):
    query_type = "recommendations.recommendProducts"

    def __init__(self, product_recommendation_service: ProductRecommendationService) -> None:
        self.product_recommendation_service = product_recommendation_service

    async def execute(self, query: RecommendProductsQuery) -> RecommendationResponse:
        return await self.product_recommendation_service.recommend_products(query.request)
