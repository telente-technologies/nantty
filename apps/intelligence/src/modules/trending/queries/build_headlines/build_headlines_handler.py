from src.interfaces.cqrs_interface import QueryHandler
from src.modules.trending.dtos.headline_dto import HeadlineResponse
from src.modules.trending.queries.build_headlines.build_headlines_query import BuildHeadlinesQuery
from src.modules.trending.services.headline_clustering_service import build_headlines_from_posts


class BuildHeadlinesHandler(QueryHandler[BuildHeadlinesQuery, HeadlineResponse]):
    query_type = "trending.buildHeadlines"

    async def execute(self, query: BuildHeadlinesQuery) -> HeadlineResponse:
        return build_headlines_from_posts(query.request)
