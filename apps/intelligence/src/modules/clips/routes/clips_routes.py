from fastapi import APIRouter

from src.modules.clips.controllers.clips_controller import ClipsController
from src.modules.clips.dtos.clip_ranking_dto import ClipRankingResponse


def build_clips_router(controller: ClipsController) -> APIRouter:
    router = APIRouter(prefix="/v1", tags=["clips"])
    router.add_api_route("/clips/rank", controller.rank_clips, methods=["POST"], response_model=ClipRankingResponse)
    return router
