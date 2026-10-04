from src.modules.search.dtos.search_rerank_dto import SearchRerankRequest, SearchRerankResponse
from src.modules.search.queries.rerank_search_results.rerank_search_results_query import RerankSearchResultsQuery
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class SearchController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def rerank_search(self, request: SearchRerankRequest) -> SearchRerankResponse:
        response: SearchRerankResponse = await run_within_request_deadline(
            self.query_bus.execute(RerankSearchResultsQuery(request)), self.deadline_seconds
        )
        return response
