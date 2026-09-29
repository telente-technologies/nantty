from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.trending.controllers.trending_controller import TrendingController
from src.modules.trending.queries.read_trending_items.read_trending_items_handler import ReadTrendingItemsHandler
from src.modules.trending.routes.trending_routes import build_trending_router


class TrendingModule:
    module_id = "trending"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(ReadTrendingItemsHandler(container.trending_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        controller = TrendingController(container.query_bus, container.settings.request_deadline_seconds)
        return build_trending_router(controller)
