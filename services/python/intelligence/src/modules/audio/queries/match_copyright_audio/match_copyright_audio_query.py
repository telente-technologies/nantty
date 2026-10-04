from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.audio.dtos.copyright_audio_match_dto import CopyrightAudioMatchRequest


@dataclass(frozen=True, slots=True)
class MatchCopyrightAudioQuery(Query):
    query_type: ClassVar[str] = "audio.matchCopyrightAudio"
    request: CopyrightAudioMatchRequest
