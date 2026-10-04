from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.trending.dtos.headline_dto import HeadlineRequest


@dataclass(frozen=True, slots=True)
class BuildHeadlinesQuery(Query):
    query_type: ClassVar[str] = "trending.buildHeadlines"
    request: HeadlineRequest
