from fastapi import APIRouter

from src.modules.trending.controllers.trending_controller import TrendingController
from src.modules.trending.dtos.trending_dto import TrendingResponse


def build_trending_router(controller: TrendingController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["trending"])
    router.add_api_route("/trending", controller.read_trending, methods=["POST"], response_model=TrendingResponse)
    return router
