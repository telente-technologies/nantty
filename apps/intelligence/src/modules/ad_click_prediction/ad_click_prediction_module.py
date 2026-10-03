from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.ad_click_prediction.controllers.ad_click_prediction_controller import AdClickPredictionController
from src.modules.ad_click_prediction.queries.predict_ad_click_rate.predict_ad_click_rate_handler import (
    PredictAdClickRateHandler,
)
from src.modules.ad_click_prediction.routes.ad_click_prediction_routes import build_ad_click_prediction_router


class AdClickPredictionModule:
    module_id = "ad_click_prediction"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(PredictAdClickRateHandler(container.ad_click_prediction_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        controller = AdClickPredictionController(container.query_bus, container.settings.request_deadline_seconds)
        return build_ad_click_prediction_router(controller)
