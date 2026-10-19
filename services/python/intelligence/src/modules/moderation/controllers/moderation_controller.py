from src.modules.child_safety.dtos.child_safety_dto import MediaScanRequest, MediaScanResponse
from src.modules.content_scoring.dtos.content_score_dto import ImageModerationRequest, ImageModerationResponse
from src.modules.moderation.dtos.content_moderation_dto import ContentModerationRequest, ContentModerationResponse
from src.modules.moderation.queries.classify_content.classify_content_query import ClassifyContentQuery
from src.modules.moderation.queries.classify_image.classify_image_query import ClassifyImageQuery
from src.modules.moderation.queries.scan_media.scan_media_query import ScanMediaQuery
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class ModerationController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float, media_scan_deadline_seconds: float = 4.5) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds
        self.media_scan_deadline_seconds = media_scan_deadline_seconds

    async def classify_content(self, request: ContentModerationRequest) -> ContentModerationResponse:
        response: ContentModerationResponse = await run_within_request_deadline(
            self.query_bus.execute(ClassifyContentQuery(request)), self.deadline_seconds
        )
        return response

    async def classify_image(self, request: ImageModerationRequest) -> ImageModerationResponse:
        response: ImageModerationResponse = await run_within_request_deadline(
            self.query_bus.execute(ClassifyImageQuery(request)), self.deadline_seconds
        )
        return response

    async def scan_media(self, request: MediaScanRequest) -> MediaScanResponse:
        response: MediaScanResponse = await run_within_request_deadline(
            self.query_bus.execute(ScanMediaQuery(request)), self.media_scan_deadline_seconds
        )
        return response
