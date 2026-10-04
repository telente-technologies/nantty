from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.clips.controllers.clips_controller import ClipsController
from src.modules.clips.queries.rank_clip_candidates.rank_clip_candidates_handler import RankClipCandidatesHandler
from src.modules.clips.routes.clips_routes import build_clips_router


class ClipsModule:
    module_id = "clips"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(RankClipCandidatesHandler(container.clip_ranking_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        controller = ClipsController(container.query_bus, container.settings.request_deadline_seconds)
        return build_clips_router(controller)
