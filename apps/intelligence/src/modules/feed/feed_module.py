from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.feed.controllers.feed_controller import FeedController
from src.modules.feed.queries.rank_feed_candidates.rank_feed_candidates_handler import RankFeedCandidatesHandler
from src.modules.feed.routes.feed_routes import build_feed_router


class FeedModule:
    module_id = "feed"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(RankFeedCandidatesHandler(container.feed_ranking_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        controller = FeedController(container.query_bus, container.settings.request_deadline_seconds)
        return build_feed_router(controller)
