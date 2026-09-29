from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query

from app.models.discovery_model import SearchRerankRequest, SearchRerankResponse, TrendingRequest, TrendingResponse
from app.models.experiment_model import (
    EXPERIMENT_KEY_PATTERN,
    ExperimentAssignmentRequest,
    ExperimentAssignmentResponse,
    ExperimentMetricsResponse,
)
from app.models.recommendation_model import (
    AccountRecommendationRequest,
    ClipSuggestionRequest,
    ProductRecommendationRequest,
    RecommendationResponse,
)
from app.models.risk_scoring_model import RiskScoringRequest, RiskScoringResponse
from app.routes.route_dependencies import ContainerDependency, run_within_request_deadline
from app.stores.feature_backend_protocol import FeatureBackendUnavailableError

discovery_router = APIRouter(prefix="/v1", tags=["discovery"])


@discovery_router.post("/recommendations/products", response_model=RecommendationResponse)
async def recommend_products_route(
    request: ProductRecommendationRequest, container: ContainerDependency
) -> RecommendationResponse:
    service = container.product_recommendation_service
    return await run_within_request_deadline(service.recommend_products(request), container)


@discovery_router.post("/recommendations/accounts", response_model=RecommendationResponse)
async def recommend_accounts_route(
    request: AccountRecommendationRequest, container: ContainerDependency
) -> RecommendationResponse:
    service = container.account_and_clip_recommendation_service
    return await run_within_request_deadline(service.recommend_accounts(request), container)


@discovery_router.post("/recommendations/clips", response_model=RecommendationResponse)
async def suggest_clips_route(request: ClipSuggestionRequest, container: ContainerDependency) -> RecommendationResponse:
    service = container.account_and_clip_recommendation_service
    return await run_within_request_deadline(service.suggest_clips(request), container)


@discovery_router.post("/trending", response_model=TrendingResponse)
async def read_trending_route(request: TrendingRequest, container: ContainerDependency) -> TrendingResponse:
    return await run_within_request_deadline(container.trending_service.read_trending(request), container)


@discovery_router.post("/search/rerank", response_model=SearchRerankResponse)
async def rerank_search_route(request: SearchRerankRequest, container: ContainerDependency) -> SearchRerankResponse:
    return await run_within_request_deadline(container.search_reranking_service.rerank(request), container)


@discovery_router.post("/risk/score", response_model=RiskScoringResponse)
async def score_risk_route(request: RiskScoringRequest, container: ContainerDependency) -> RiskScoringResponse:
    return await run_within_request_deadline(container.risk_scoring_service.score_risk(request), container)


@discovery_router.post("/experiments/assign", response_model=ExperimentAssignmentResponse)
async def assign_experiments_route(
    request: ExperimentAssignmentRequest, container: ContainerDependency
) -> ExperimentAssignmentResponse:
    return await run_within_request_deadline(container.experiment_service.assign_variants(request), container)


@discovery_router.get("/experiments/{experiment_key}/metrics", response_model=ExperimentMetricsResponse)
async def read_experiment_metrics_route(
    experiment_key: Annotated[str, Path(pattern=EXPERIMENT_KEY_PATTERN)],
    variants: Annotated[str, Query(pattern=r"^[a-z0-9_\-]{1,64}(,[a-z0-9_\-]{1,64}){0,9}$")],
    container: ContainerDependency,
) -> ExperimentMetricsResponse:
    try:
        return await container.experiment_service.read_variant_metrics(experiment_key, variants.split(","))
    except FeatureBackendUnavailableError as backend_error:
        raise HTTPException(status_code=503, detail="feature_store_unavailable") from backend_error
