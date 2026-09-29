from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.recommendations.dtos.recommendation_dto import AccountRecommendationRequest


@dataclass(frozen=True, slots=True)
class RecommendAccountsQuery(Query):
    query_type: ClassVar[str] = "recommendations.recommendAccounts"
    request: AccountRecommendationRequest
