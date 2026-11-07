from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.recommendations.dtos.recommendation_dto import ProductCandidateRecallRequest


@dataclass(frozen=True, slots=True)
class RecallProductCandidatesQuery(Query):
    query_type: ClassVar[str] = "recommendations.recallProductCandidates"
    request: ProductCandidateRecallRequest
