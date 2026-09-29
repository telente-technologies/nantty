from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.recommendations.dtos.recommendation_dto import ProductRecommendationRequest


@dataclass(frozen=True, slots=True)
class RecommendProductsQuery(Query):
    query_type: ClassVar[str] = "recommendations.recommendProducts"
    request: ProductRecommendationRequest
