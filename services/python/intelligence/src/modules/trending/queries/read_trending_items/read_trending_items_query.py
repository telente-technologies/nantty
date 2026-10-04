from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.trending.dtos.trending_dto import TrendingRequest


@dataclass(frozen=True, slots=True)
class ReadTrendingItemsQuery(Query):
    query_type: ClassVar[str] = "trending.readTrendingItems"
    request: TrendingRequest
