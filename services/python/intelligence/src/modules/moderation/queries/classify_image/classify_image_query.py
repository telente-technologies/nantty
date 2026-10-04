from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.content_scoring.dtos.content_score_dto import ImageModerationRequest


@dataclass(frozen=True, slots=True)
class ClassifyImageQuery(Query):
    query_type: ClassVar[str] = "moderation.classifyImage"
    request: ImageModerationRequest
