from fastapi import APIRouter

from src.modules.verification_eligibility.controllers.verification_eligibility_controller import (
    VerificationEligibilityController,
)
from src.modules.verification_eligibility.dtos.verification_eligibility_dto import VerificationEligibilityResponse


def build_verification_eligibility_router(controller: VerificationEligibilityController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["verification_eligibility"])
    router.add_api_route(
        "/verification/eligibility",
        controller.assess_verification_eligibility,
        methods=["POST"],
        response_model=VerificationEligibilityResponse,
    )
    return router
