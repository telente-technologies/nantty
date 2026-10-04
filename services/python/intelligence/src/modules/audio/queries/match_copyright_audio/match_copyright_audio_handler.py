from src.interfaces.cqrs_interface import QueryHandler
from src.modules.audio.dtos.copyright_audio_match_dto import CopyrightAudioMatchResponse
from src.modules.audio.queries.match_copyright_audio.match_copyright_audio_query import MatchCopyrightAudioQuery
from src.modules.audio.services.chromaprint_match_service import CopyrightAudioMatchService


class MatchCopyrightAudioHandler(QueryHandler[MatchCopyrightAudioQuery, CopyrightAudioMatchResponse]):
    query_type = "audio.matchCopyrightAudio"

    def __init__(self, match_service: CopyrightAudioMatchService) -> None:
        self.match_service = match_service

    async def execute(self, query: MatchCopyrightAudioQuery) -> CopyrightAudioMatchResponse:
        return await self.match_service.match(query.request)
