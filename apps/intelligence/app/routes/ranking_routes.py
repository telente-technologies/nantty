from fastapi import APIRouter

from app.models.ads_model import AdSelectionRequest, AdSelectionResponse
from app.models.clip_ranking_model import ClipRankingRequest, ClipRankingResponse
from app.models.feed_ranking_model import (
    FeedRankingRequest,
    FeedRankingResponse,
    SocialProofRequest,
    SocialProofResponse,
)
from app.routes.route_dependencies import ContainerDependency, run_within_request_deadline
from app.services.social_proof_service import SocialProofService

ranking_router = APIRouter(prefix="/v1", tags=["ranking"])


@ranking_router.post("/feed/rank", response_model=FeedRankingResponse)
async def rank_feed_route(request: FeedRankingRequest, container: ContainerDependency) -> FeedRankingResponse:
    return await run_within_request_deadline(container.feed_ranking_service.rank_feed(request), container)


@ranking_router.post("/clips/rank", response_model=ClipRankingResponse)
async def rank_clips_route(request: ClipRankingRequest, container: ContainerDependency) -> ClipRankingResponse:
    return await run_within_request_deadline(container.clip_ranking_service.rank_clips(request), container)


@ranking_router.post("/social-proof/select", response_model=SocialProofResponse)
async def select_social_proof_route(request: SocialProofRequest, container: ContainerDependency) -> SocialProofResponse:
    service = SocialProofService(container.feature_store)
    return await run_within_request_deadline(service.select_social_proof(request), container)


@ranking_router.post("/ads/select", response_model=AdSelectionResponse)
async def select_ads_route(request: AdSelectionRequest, container: ContainerDependency) -> AdSelectionResponse:
    return await run_within_request_deadline(container.ad_selection_service.select_ads(request), container)
