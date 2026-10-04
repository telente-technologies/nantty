from src.modules.verification_eligibility.dtos.verification_eligibility_dto import (
    VerificationEligibilityRequest,
    VerificationEligibilityResponse,
)
from src.modules.verification_eligibility.queries.assess_eligibility.assess_eligibility_query import (
    AssessVerificationEligibilityQuery,
)
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class VerificationEligibilityController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def assess_verification_eligibility(
        self, request: VerificationEligibilityRequest
    ) -> VerificationEligibilityResponse:
        response: VerificationEligibilityResponse = await run_within_request_deadline(
            self.query_bus.execute(AssessVerificationEligibilityQuery(request)), self.deadline_seconds
        )
        return response
