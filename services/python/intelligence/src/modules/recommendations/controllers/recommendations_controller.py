from src.modules.recommendations.dtos.recommendation_dto import (
    AccountRecommendationRequest,
    ClipSuggestionRequest,
    ProductCandidateRecallRequest,
    ProductCandidateRecallResponse,
    ProductRecommendationRequest,
    RecommendationResponse,
)
from src.modules.recommendations.queries.recommend_accounts.recommend_accounts_query import RecommendAccountsQuery
from src.modules.recommendations.queries.recommend_products.recommend_products_query import RecommendProductsQuery
from src.modules.recommendations.queries.recall_product_candidates.recall_product_candidates_query import (
    RecallProductCandidatesQuery,
)
from src.modules.recommendations.queries.suggest_clips.suggest_clips_query import SuggestClipsQuery
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class RecommendationsController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def recommend_products(self, request: ProductRecommendationRequest) -> RecommendationResponse:
        response: RecommendationResponse = await run_within_request_deadline(
            self.query_bus.execute(RecommendProductsQuery(request)), self.deadline_seconds
        )
        return response

    async def recall_product_candidates(
        self, request: ProductCandidateRecallRequest
    ) -> ProductCandidateRecallResponse:
        item_ids = await run_within_request_deadline(
            self.query_bus.execute(RecallProductCandidatesQuery(request)), self.deadline_seconds
        )
        return ProductCandidateRecallResponse(item_ids=item_ids)

    async def recommend_accounts(self, request: AccountRecommendationRequest) -> RecommendationResponse:
        response: RecommendationResponse = await run_within_request_deadline(
            self.query_bus.execute(RecommendAccountsQuery(request)), self.deadline_seconds
        )
        return response

    async def suggest_clips(self, request: ClipSuggestionRequest) -> RecommendationResponse:
        response: RecommendationResponse = await run_within_request_deadline(
            self.query_bus.execute(SuggestClipsQuery(request)), self.deadline_seconds
        )
        return response
