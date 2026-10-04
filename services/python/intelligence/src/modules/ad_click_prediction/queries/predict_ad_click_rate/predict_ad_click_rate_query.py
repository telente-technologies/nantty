from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.ad_click_prediction.dtos.ad_click_prediction_dto import AdClickPredictionRequest


@dataclass(frozen=True, slots=True)
class PredictAdClickRateQuery(Query):
    query_type: ClassVar[str] = "adClickPrediction.predictAdClickRate"
    request: AdClickPredictionRequest
