from src.modules.moderation.dtos.content_moderation_dto import ContentModerationRequest, ContentModerationResponse
from src.modules.moderation.queries.classify_content.classify_content_query import ClassifyContentQuery
from src.utils.cqrs_util import QueryBus
from src.utils.request_deadline_util import run_within_request_deadline


class ModerationController:
    def __init__(self, query_bus: QueryBus, deadline_seconds: float) -> None:
        self.query_bus = query_bus
        self.deadline_seconds = deadline_seconds

    async def classify_content(self, request: ContentModerationRequest) -> ContentModerationResponse:
        response: ContentModerationResponse = await run_within_request_deadline(
            self.query_bus.execute(ClassifyContentQuery(request)), self.deadline_seconds
        )
        return response
