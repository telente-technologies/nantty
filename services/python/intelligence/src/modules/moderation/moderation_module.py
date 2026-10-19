from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.moderation.controllers.moderation_controller import ModerationController
from src.modules.moderation.queries.classify_content.classify_content_handler import ClassifyContentHandler
from src.modules.moderation.queries.classify_image.classify_image_handler import ClassifyImageHandler
from src.modules.moderation.queries.scan_media.scan_media_handler import ScanMediaHandler
from src.modules.moderation.routes.moderation_routes import build_moderation_router


class ModerationModule:
    module_id = "moderation"

    def register_handlers(self, container: ApplicationContainer) -> None:
        container.query_bus.register_handler(ClassifyContentHandler(container.content_moderation_service))
        container.query_bus.register_handler(ClassifyImageHandler(container.image_moderation_service))
        container.query_bus.register_handler(ScanMediaHandler(container.media_child_safety_scan_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        controller = ModerationController(
            container.query_bus,
            container.settings.request_deadline_seconds,
            container.settings.media_scan_deadline_seconds,
        )
        return build_moderation_router(controller)
