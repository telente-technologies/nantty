from src.interfaces.cqrs_interface import QueryHandler
from src.modules.trending.dtos.trending_dto import TrendingResponse
from src.modules.trending.queries.read_trending_items.read_trending_items_query import ReadTrendingItemsQuery
from src.modules.trending.services.trending_service import TrendingService


class ReadTrendingItemsHandler(QueryHandler[ReadTrendingItemsQuery, TrendingResponse]):
    query_type = "trending.readTrendingItems"

    def __init__(self, trending_service: TrendingService) -> None:
        self.trending_service = trending_service

    async def execute(self, query: ReadTrendingItemsQuery) -> TrendingResponse:
        return await self.trending_service.read_trending(query.request)
