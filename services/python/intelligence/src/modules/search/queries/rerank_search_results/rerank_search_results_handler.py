from src.interfaces.cqrs_interface import QueryHandler
from src.modules.search.dtos.search_rerank_dto import SearchRerankResponse
from src.modules.search.queries.rerank_search_results.rerank_search_results_query import RerankSearchResultsQuery
from src.modules.search.services.search_reranking_service import SearchRerankingService


class RerankSearchResultsHandler(QueryHandler[RerankSearchResultsQuery, SearchRerankResponse]):
    query_type = "search.rerankSearchResults"

    def __init__(self, search_reranking_service: SearchRerankingService) -> None:
        self.search_reranking_service = search_reranking_service

    async def execute(self, query: RerankSearchResultsQuery) -> SearchRerankResponse:
        return await self.search_reranking_service.rerank(query.request)
