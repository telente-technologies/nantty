from src.modules.trending.dtos.trending_dto import TrendingRequest, TrendingResponse
from src.modules.trending.queries.read_trending_items.read_trending_items_query import ReadTrendingItemsQuery
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class TrendingController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def read_trending(self, request: TrendingRequest) -> TrendingResponse:
        response: TrendingResponse = await run_within_request_deadline(
            self.query_bus.execute(ReadTrendingItemsQuery(request)), self.deadline_seconds
        )
        return response
