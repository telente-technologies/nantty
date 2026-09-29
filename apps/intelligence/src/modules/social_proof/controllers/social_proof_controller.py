from src.modules.social_proof.dtos.social_proof_dto import SocialProofRequest, SocialProofResponse
from src.modules.social_proof.queries.select_social_proof_banners.select_social_proof_banners_query import (
    SelectSocialProofBannersQuery,
)
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class SocialProofController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def select_social_proof(self, request: SocialProofRequest) -> SocialProofResponse:
        response: SocialProofResponse = await run_within_request_deadline(
            self.query_bus.execute(SelectSocialProofBannersQuery(request)), self.deadline_seconds
        )
        return response
