from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.audio.dtos.audio_fingerprint_dto import AudioMatchRequest


@dataclass(frozen=True, slots=True)
class MatchAudioExcerptQuery(Query):
    query_type: ClassVar[str] = "audio.matchAudioExcerpt"
    request: AudioMatchRequest
