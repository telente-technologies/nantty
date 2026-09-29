from fastapi import APIRouter

from src.modules.feed.controllers.feed_controller import FeedController
from src.modules.feed.dtos.feed_ranking_dto import FeedRankingResponse


def build_feed_router(controller: FeedController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["feed"])
    router.add_api_route("/feed/rank", controller.rank_feed, methods=["POST"], response_model=FeedRankingResponse)
    return router
