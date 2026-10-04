from src.interfaces.cqrs_interface import QueryHandler
from src.modules.moderation.dtos.content_moderation_dto import ContentModerationResponse
from src.modules.moderation.queries.classify_content.classify_content_query import ClassifyContentQuery
from src.modules.moderation.services.content_moderation_service import ContentModerationService


class ClassifyContentHandler(QueryHandler[ClassifyContentQuery, ContentModerationResponse]):
    query_type = "moderation.classifyContent"

    def __init__(self, service: ContentModerationService) -> None:
        self.service = service

    async def execute(self, query: ClassifyContentQuery) -> ContentModerationResponse:
        return await self.service.classify_content(query.request)
