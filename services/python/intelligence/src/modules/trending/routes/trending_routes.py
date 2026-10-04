from fastapi import APIRouter

from src.modules.trending.controllers.trending_controller import TrendingController
from src.modules.trending.dtos.headline_dto import HeadlineResponse
from src.modules.trending.dtos.trending_dto import TrendingResponse


def build_trending_router(controller: TrendingController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["trending"])
    router.add_api_route("/trending", controller.read_trending, methods=["POST"], response_model=TrendingResponse)
    router.add_api_route(
        "/trending/headlines", controller.build_headlines, methods=["POST"], response_model=HeadlineResponse
    )
    return router
