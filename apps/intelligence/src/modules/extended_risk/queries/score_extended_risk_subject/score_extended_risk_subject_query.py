from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.extended_risk.dtos.extended_risk_dto import ExtendedRiskRequest


@dataclass(frozen=True, slots=True)
class ScoreExtendedRiskSubjectQuery(Query):
    query_type: ClassVar[str] = "extendedRisk.scoreExtendedRiskSubject"
    request: ExtendedRiskRequest
