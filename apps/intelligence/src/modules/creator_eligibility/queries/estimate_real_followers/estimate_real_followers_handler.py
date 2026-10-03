from src.interfaces.cqrs_interface import QueryHandler
from src.modules.creator_eligibility.dtos.real_followers_dto import RealFollowersResponse
from src.modules.creator_eligibility.queries.estimate_real_followers.estimate_real_followers_query import (
    EstimateRealFollowersQuery,
)
from src.modules.creator_eligibility.services.real_followers_estimation_service import RealFollowersEstimationService


class EstimateRealFollowersHandler(QueryHandler[EstimateRealFollowersQuery, RealFollowersResponse]):
    query_type = "creatorEligibility.estimateRealFollowers"

    def __init__(self, service: RealFollowersEstimationService) -> None:
        self.service = service

    async def execute(self, query: EstimateRealFollowersQuery) -> RealFollowersResponse:
        return await self.service.estimate_real_followers(query.request)
