from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.creator_eligibility.controllers.creator_eligibility_controller import CreatorEligibilityController
from src.modules.creator_eligibility.queries.estimate_real_followers.estimate_real_followers_handler import (
    EstimateRealFollowersHandler,
)
from src.modules.creator_eligibility.routes.creator_eligibility_routes import build_creator_eligibility_router


class CreatorEligibilityModule:
    module_id = "creator_eligibility"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(EstimateRealFollowersHandler(container.real_followers_estimation_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        controller = CreatorEligibilityController(container.query_bus, container.settings.request_deadline_seconds)
        return build_creator_eligibility_router(controller)
