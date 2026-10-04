from fastapi import APIRouter

from src.container import ApplicationContainer
from src.integrations.media_fingerprint_integration import (
    HttpMediaAudioFingerprintSource,
    UnavailableAudioFingerprintSource,
)
from src.interfaces.audio_fingerprint_source_interface import AudioFingerprintSource
from src.modules.audio.commands.register_audio_fingerprint.register_audio_fingerprint_handler import (
    RegisterAudioFingerprintHandler,
)
from src.modules.audio.commands.update_sound_status.update_sound_status_handler import UpdateSoundStatusHandler
from src.modules.audio.controllers.audio_controller import AudioController
from src.modules.audio.queries.match_audio_excerpt.match_audio_excerpt_handler import MatchAudioExcerptHandler
from src.modules.audio.queries.match_copyright_audio.match_copyright_audio_handler import MatchCopyrightAudioHandler
from src.modules.audio.routes.audio_routes import build_audio_router
from src.modules.audio.services.chromaprint_match_service import CopyrightAudioMatchService


def build_audio_fingerprint_source(container: ApplicationContainer) -> AudioFingerprintSource:
    settings = container.settings
    if not settings.media_internal_url:
        return UnavailableAudioFingerprintSource()
    return HttpMediaAudioFingerprintSource(
        settings.media_internal_url,
        settings.media_internal_token.get_secret_value(),
        settings.media_internal_timeout_seconds,
    )


class AudioModule:
    module_id = "audio"

    def register_handlers(self, container: ApplicationContainer) -> None:
        index_service = container.audio_fingerprint_index_service
        container.command_bus.register_handler(RegisterAudioFingerprintHandler(index_service))
        container.command_bus.register_handler(UpdateSoundStatusHandler(index_service))
        container.query_bus.register_handler(MatchAudioExcerptHandler(index_service))
        container.query_bus.register_handler(
            MatchCopyrightAudioHandler(CopyrightAudioMatchService(build_audio_fingerprint_source(container)))
        )

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        return build_audio_router(AudioController(container.command_bus, container.query_bus))
