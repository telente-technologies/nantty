from src.interfaces.cqrs_interface import QueryHandler
from src.modules.verification_eligibility.dtos.verification_eligibility_dto import VerificationEligibilityResponse
from src.modules.verification_eligibility.queries.assess_eligibility.assess_eligibility_query import (
    AssessVerificationEligibilityQuery,
)
from src.modules.verification_eligibility.services.verification_trust_scoring_service import (
    VerificationTrustScoringService,
)


class AssessVerificationEligibilityHandler(
    QueryHandler[AssessVerificationEligibilityQuery, VerificationEligibilityResponse]
):
    query_type = "verificationEligibility.assess"

    def __init__(self, service: VerificationTrustScoringService) -> None:
        self.service = service

    async def execute(self, query: AssessVerificationEligibilityQuery) -> VerificationEligibilityResponse:
        return await self.service.assess(query.request)
