from fastapi import APIRouter

from src.modules.social_proof.controllers.social_proof_controller import SocialProofController
from src.modules.social_proof.dtos.social_proof_dto import SocialProofResponse


def build_social_proof_router(controller: SocialProofController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["social_proof"])
    router.add_api_route(
        "/social-proof/select", controller.select_social_proof, methods=["POST"], response_model=SocialProofResponse
    )
    return router
