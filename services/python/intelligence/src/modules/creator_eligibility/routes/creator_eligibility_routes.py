from fastapi import APIRouter

from src.modules.creator_eligibility.controllers.creator_eligibility_controller import CreatorEligibilityController
from src.modules.creator_eligibility.dtos.real_followers_dto import RealFollowersResponse


def build_creator_eligibility_router(controller: CreatorEligibilityController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["creator_eligibility"])
    router.add_api_route(
        "/creators/real-followers",
        controller.estimate_real_followers,
        methods=["POST"],
        response_model=RealFollowersResponse,
    )
    return router
