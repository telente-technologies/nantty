from collections.abc import Awaitable
from typing import Any

from fastapi import HTTPException

from src.interfaces.feature_backend_interface import FeatureBackendUnavailableError
from src.modules.audio.commands.register_audio_fingerprint.register_audio_fingerprint_command import (
    RegisterAudioFingerprintCommand,
)
from src.modules.audio.commands.update_sound_status.update_sound_status_command import UpdateSoundStatusCommand
from src.modules.audio.dtos.audio_fingerprint_dto import (
    AudioFingerprintRegistrationRequest,
    AudioFingerprintRegistrationResponse,
    AudioMatchRequest,
    AudioMatchResponse,
    AudioSoundStatusResponse,
    AudioSoundStatusUpdateRequest,
)
from src.modules.audio.dtos.copyright_audio_match_dto import CopyrightAudioMatchRequest, CopyrightAudioMatchResponse
from src.modules.audio.queries.match_audio_excerpt.match_audio_excerpt_query import MatchAudioExcerptQuery
from src.modules.audio.queries.match_copyright_audio.match_copyright_audio_query import MatchCopyrightAudioQuery
from src.modules.audio.services.audio_fingerprint_index_service import (
    AudioSoundAlreadyRegisteredError,
    AudioSoundNotFoundError,
)
from src.modules.audio.services.audio_landmark_fingerprint_service import AudioTooQuietOrShortError
from src.utils.cqrs_util import CommandBus, QueryBus
from src.utils.request_deadline_util import run_within_request_deadline

AUDIO_REQUEST_DEADLINE_SECONDS = 3.0
COPYRIGHT_MATCH_DEADLINE_SECONDS = 60.0


async def translate_audio_errors(operation: Awaitable[Any]) -> Any:
    try:
        return await run_within_request_deadline(operation, AUDIO_REQUEST_DEADLINE_SECONDS)
    except AudioSoundAlreadyRegisteredError as conflict:
        raise HTTPException(status_code=409, detail="sound_already_registered") from conflict
    except AudioSoundNotFoundError as missing:
        raise HTTPException(status_code=404, detail="sound_not_registered") from missing
    except AudioTooQuietOrShortError as unusable_audio:
        raise HTTPException(status_code=422, detail="audio_unusable_for_fingerprinting") from unusable_audio
    except FeatureBackendUnavailableError as backend_error:
        raise HTTPException(status_code=503, detail="fingerprint_store_unavailable") from backend_error


class AudioController:
    def __init__(self, command_bus: CommandBus, query_bus: QueryBus) -> None:
        self.command_bus = command_bus
        self.query_bus = query_bus

    async def register_fingerprint(
        self, request: AudioFingerprintRegistrationRequest
    ) -> AudioFingerprintRegistrationResponse:
        response: AudioFingerprintRegistrationResponse = await translate_audio_errors(
            self.command_bus.execute(RegisterAudioFingerprintCommand(request))
        )
        return response

    async def match_excerpt(self, request: AudioMatchRequest) -> AudioMatchResponse:
        response: AudioMatchResponse = await translate_audio_errors(
            self.query_bus.execute(MatchAudioExcerptQuery(request))
        )
        return response

    async def update_sound_status(self, request: AudioSoundStatusUpdateRequest) -> AudioSoundStatusResponse:
        response: AudioSoundStatusResponse = await translate_audio_errors(
            self.command_bus.execute(UpdateSoundStatusCommand(request))
        )
        return response

    async def match_copyright_audio(self, request: CopyrightAudioMatchRequest) -> CopyrightAudioMatchResponse:
        response: CopyrightAudioMatchResponse = await run_within_request_deadline(
            self.query_bus.execute(MatchCopyrightAudioQuery(request)), COPYRIGHT_MATCH_DEADLINE_SECONDS
        )
        return response
