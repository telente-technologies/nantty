from fastapi import APIRouter

from src.modules.ad_click_prediction.controllers.ad_click_prediction_controller import AdClickPredictionController
from src.modules.ad_click_prediction.dtos.ad_click_prediction_dto import AdClickPredictionResponse


def build_ad_click_prediction_router(controller: AdClickPredictionController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["ads"])
    router.add_api_route(
        "/ads/predicted-ctr",
        controller.predict_ad_click_rate,
        methods=["POST"],
        response_model=AdClickPredictionResponse,
    )
    return router
