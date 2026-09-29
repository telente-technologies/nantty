from fastapi import APIRouter

from src.container import ApplicationContainer
from src.modules.audio.commands.register_audio_fingerprint.register_audio_fingerprint_handler import (
    RegisterAudioFingerprintHandler,
)
from src.modules.audio.commands.update_sound_status.update_sound_status_handler import UpdateSoundStatusHandler
from src.modules.audio.controllers.audio_controller import AudioController
from src.modules.audio.queries.match_audio_excerpt.match_audio_excerpt_handler import MatchAudioExcerptHandler
from src.modules.audio.routes.audio_routes import build_audio_router


class AudioModule:
    module_id = "audio"

    def register_handlers(self, container: ApplicationContainer) -> None:
        index_service = container.audio_fingerprint_index_service
        container.command_bus.register_handler(RegisterAudioFingerprintHandler(index_service))
        container.command_bus.register_handler(UpdateSoundStatusHandler(index_service))
        container.query_bus.register_handler(MatchAudioExcerptHandler(index_service))

    def build_router(self, container: ApplicationContainer) -> APIRouter:
        return build_audio_router(AudioController(container.command_bus, container.query_bus))
