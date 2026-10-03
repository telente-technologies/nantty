from src.interfaces.cqrs_interface import QueryHandler
from src.modules.ad_click_prediction.dtos.ad_click_prediction_dto import AdClickPredictionResponse
from src.modules.ad_click_prediction.queries.predict_ad_click_rate.predict_ad_click_rate_query import (
    PredictAdClickRateQuery,
)
from src.modules.ad_click_prediction.services.ad_click_prediction_service import AdClickPredictionService


class PredictAdClickRateHandler(QueryHandler[PredictAdClickRateQuery, AdClickPredictionResponse]):
    query_type = "adClickPrediction.predictAdClickRate"

    def __init__(self, service: AdClickPredictionService) -> None:
        self.service = service

    async def execute(self, query: PredictAdClickRateQuery) -> AdClickPredictionResponse:
        return await self.service.predict_ad_click_rate(query.request)
