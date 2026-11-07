from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.recommendations.controllers.recommendations_controller import RecommendationsController
from src.modules.recommendations.queries.recommend_accounts.recommend_accounts_handler import RecommendAccountsHandler
from src.modules.recommendations.queries.recommend_products.recommend_products_handler import RecommendProductsHandler
from src.modules.recommendations.queries.recall_product_candidates.recall_product_candidates_handler import (
    RecallProductCandidatesHandler,
)
from src.modules.recommendations.queries.suggest_clips.suggest_clips_handler import SuggestClipsHandler
from src.modules.recommendations.routes.recommendations_routes import build_recommendations_router


class RecommendationsModule:
    module_id = "recommendations"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(RecommendProductsHandler(container.product_recommendation_service))
        container.query_bus.register_handler(RecallProductCandidatesHandler(container.product_recommendation_service))
        container.query_bus.register_handler(
            RecommendAccountsHandler(container.account_and_clip_recommendation_service)
        )
        container.query_bus.register_handler(SuggestClipsHandler(container.account_and_clip_recommendation_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        controller = RecommendationsController(container.query_bus, container.settings.request_deadline_seconds)
        return build_recommendations_router(controller)
