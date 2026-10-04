from src.modules.creator_eligibility.dtos.real_followers_dto import RealFollowersRequest, RealFollowersResponse
from src.modules.creator_eligibility.queries.estimate_real_followers.estimate_real_followers_query import (
    EstimateRealFollowersQuery,
)
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class CreatorEligibilityController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def estimate_real_followers(self, request: RealFollowersRequest) -> RealFollowersResponse:
        response: RealFollowersResponse = await run_within_request_deadline(
            self.query_bus.execute(EstimateRealFollowersQuery(request)), self.deadline_seconds
        )
        return response
