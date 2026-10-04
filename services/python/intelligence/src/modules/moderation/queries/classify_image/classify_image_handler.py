from src.interfaces.cqrs_interface import QueryHandler
from src.modules.content_scoring.dtos.content_score_dto import ImageModerationResponse
from src.modules.content_scoring.services.image_moderation_interface_service import ImageModerationService
from src.modules.moderation.queries.classify_image.classify_image_query import ClassifyImageQuery


class ClassifyImageHandler(QueryHandler[ClassifyImageQuery, ImageModerationResponse]):
    query_type = "moderation.classifyImage"

    def __init__(self, service: ImageModerationService) -> None:
        self.service = service

    async def execute(self, query: ClassifyImageQuery) -> ImageModerationResponse:
        return self.service.classify_image(query.request)
