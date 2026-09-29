from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.search.controllers.search_controller import SearchController
from src.modules.search.queries.rerank_search_results.rerank_search_results_handler import RerankSearchResultsHandler
from src.modules.search.routes.search_routes import build_search_router


class SearchModule:
    module_id = "search"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(RerankSearchResultsHandler(container.search_reranking_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        controller = SearchController(container.query_bus, container.settings.request_deadline_seconds)
        return build_search_router(controller)
