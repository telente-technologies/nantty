from src.interfaces.cqrs_interface import CommandHandler
from src.modules.audio.commands.register_audio_fingerprint.register_audio_fingerprint_command import (
    RegisterAudioFingerprintCommand,
)
from src.modules.audio.dtos.audio_fingerprint_dto import AudioFingerprintRegistrationResponse
from src.modules.audio.services.audio_fingerprint_index_service import AudioFingerprintIndexService


class RegisterAudioFingerprintHandler(
    CommandHandler[RegisterAudioFingerprintCommand, AudioFingerprintRegistrationResponse]
):
    command_type = "audio.registerAudioFingerprint"

    def __init__(self, audio_fingerprint_index_service: AudioFingerprintIndexService) -> None:
        self.audio_fingerprint_index_service = audio_fingerprint_index_service

    async def execute(self, command: RegisterAudioFingerprintCommand) -> AudioFingerprintRegistrationResponse:
        return await self.audio_fingerprint_index_service.register_sound(command.request)
