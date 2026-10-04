from fastapi import APIRouter

from src.modules.search.controllers.search_controller import SearchController
from src.modules.search.dtos.search_rerank_dto import SearchRerankResponse


def build_search_router(controller: SearchController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["search"])
    router.add_api_route(
        "/search/rerank", controller.rerank_search, methods=["POST"], response_model=SearchRerankResponse
    )
    return router
