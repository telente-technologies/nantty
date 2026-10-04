from src.interfaces.cqrs_interface import QueryHandler
from src.modules.audio.dtos.audio_fingerprint_dto import AudioMatchResponse
from src.modules.audio.queries.match_audio_excerpt.match_audio_excerpt_query import MatchAudioExcerptQuery
from src.modules.audio.services.audio_fingerprint_index_service import AudioFingerprintIndexService


class MatchAudioExcerptHandler(QueryHandler[MatchAudioExcerptQuery, AudioMatchResponse]):
    query_type = "audio.matchAudioExcerpt"

    def __init__(self, audio_fingerprint_index_service: AudioFingerprintIndexService) -> None:
        self.audio_fingerprint_index_service = audio_fingerprint_index_service

    async def execute(self, query: MatchAudioExcerptQuery) -> AudioMatchResponse:
        return await self.audio_fingerprint_index_service.match_audio(query.request)
