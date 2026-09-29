from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.risk.dtos.risk_scoring_dto import RiskScoringRequest


@dataclass(frozen=True, slots=True)
class ScoreRiskSubjectQuery(Query):
    query_type: ClassVar[str] = "risk.scoreRiskSubject"
    request: RiskScoringRequest
