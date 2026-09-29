from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.ads.controllers.ads_controller import AdsController
from src.modules.ads.queries.select_ads_for_placement.select_ads_for_placement_handler import (
    SelectAdsForPlacementHandler,
)
from src.modules.ads.routes.ads_routes import build_ads_router


class AdsModule:
    module_id = "ads"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(SelectAdsForPlacementHandler(container.ad_selection_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        controller = AdsController(container.query_bus, container.settings.request_deadline_seconds)
        return build_ads_router(controller)
