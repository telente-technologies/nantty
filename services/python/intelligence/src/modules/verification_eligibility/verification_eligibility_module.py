from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.verification_eligibility.controllers.verification_eligibility_controller import (
    VerificationEligibilityController,
)
from src.modules.verification_eligibility.queries.assess_eligibility.assess_eligibility_handler import (
    AssessVerificationEligibilityHandler,
)
from src.modules.verification_eligibility.routes.verification_eligibility_routes import (
    build_verification_eligibility_router,
)
from src.modules.verification_eligibility.services.verification_trust_scoring_service import (
    VerificationTrustScoringService,
)


class VerificationEligibilityModule:
    module_id = "verification_eligibility"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(AssessVerificationEligibilityHandler(VerificationTrustScoringService()))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        controller = VerificationEligibilityController(container.query_bus, container.settings.request_deadline_seconds)
        return build_verification_eligibility_router(controller)
