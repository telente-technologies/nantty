from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.bot_detection.dtos.bot_detection_dto import BotScoreRequest


@dataclass(frozen=True, slots=True)
class ScoreBotLikelihoodQuery(Query):
    query_type: ClassVar[str] = "botDetection.scoreBotLikelihood"
    request: BotScoreRequest
