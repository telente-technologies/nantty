from fastapi import APIRouter

from src.modules.ads.controllers.ads_controller import AdsController
from src.modules.ads.dtos.ad_selection_dto import AdSelectionResponse


def build_ads_router(controller: AdsController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["ads"])
    router.add_api_route("/ads/select", controller.select_ads, methods=["POST"], response_model=AdSelectionResponse)
    return router
