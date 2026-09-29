from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.recommendations.dtos.recommendation_dto import ClipSuggestionRequest


@dataclass(frozen=True, slots=True)
class SuggestClipsQuery(Query):
    query_type: ClassVar[str] = "recommendations.suggestClips"
    request: ClipSuggestionRequest
