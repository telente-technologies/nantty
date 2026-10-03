from src.modules.ad_click_prediction.dtos.ad_click_prediction_dto import (
    AdClickPredictionRequest,
    AdClickPredictionResponse,
)
from src.modules.ad_click_prediction.queries.predict_ad_click_rate.predict_ad_click_rate_query import (
    PredictAdClickRateQuery,
)
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class AdClickPredictionController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def predict_ad_click_rate(self, request: AdClickPredictionRequest) -> AdClickPredictionResponse:
        response: AdClickPredictionResponse = await run_within_request_deadline(
            self.query_bus.execute(PredictAdClickRateQuery(request)), self.deadline_seconds
        )
        return response
