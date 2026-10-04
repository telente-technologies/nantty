from fastapi import APIRouter

from src.modules.recommendations.controllers.recommendations_controller import RecommendationsController
from src.modules.recommendations.dtos.recommendation_dto import RecommendationResponse


def build_recommendations_router(controller: RecommendationsController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["recommendations"])
    router.add_api_route(
        "/recommendations/products",
        controller.recommend_products,
        methods=["POST"],
        response_model=RecommendationResponse,
    )
    router.add_api_route(
        "/recommendations/accounts",
        controller.recommend_accounts,
        methods=["POST"],
        response_model=RecommendationResponse,
    )
    router.add_api_route(
        "/recommendations/clips", controller.suggest_clips, methods=["POST"], response_model=RecommendationResponse
    )
    return router
