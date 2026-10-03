from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.moderation.dtos.content_moderation_dto import ContentModerationRequest


@dataclass(frozen=True, slots=True)
class ClassifyContentQuery(Query):
    query_type: ClassVar[str] = "moderation.classifyContent"
    request: ContentModerationRequest
