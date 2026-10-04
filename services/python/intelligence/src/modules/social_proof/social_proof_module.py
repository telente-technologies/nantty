from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.social_proof.controllers.social_proof_controller import SocialProofController
from src.modules.social_proof.queries.select_social_proof_banners.select_social_proof_banners_handler import (
    SelectSocialProofBannersHandler,
)
from src.modules.social_proof.routes.social_proof_routes import build_social_proof_router


class SocialProofModule:
    module_id = "social_proof"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(SelectSocialProofBannersHandler(container.social_proof_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        controller = SocialProofController(container.query_bus, container.settings.request_deadline_seconds)
        return build_social_proof_router(controller)
