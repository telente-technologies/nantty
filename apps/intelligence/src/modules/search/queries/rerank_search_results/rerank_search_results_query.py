from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.search.dtos.search_rerank_dto import SearchRerankRequest


@dataclass(frozen=True, slots=True)
class RerankSearchResultsQuery(Query):
    query_type: ClassVar[str] = "search.rerankSearchResults"
    request: SearchRerankRequest
