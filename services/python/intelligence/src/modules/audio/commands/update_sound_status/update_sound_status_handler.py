from src.interfaces.cqrs_interface import CommandHandler
from src.modules.audio.commands.update_sound_status.update_sound_status_command import UpdateSoundStatusCommand
from src.modules.audio.dtos.audio_fingerprint_dto import AudioSoundStatusResponse
from src.modules.audio.services.audio_fingerprint_index_service import AudioFingerprintIndexService


class UpdateSoundStatusHandler(CommandHandler[UpdateSoundStatusCommand, AudioSoundStatusResponse]):
    command_type = "audio.updateSoundStatus"

    def __init__(self, audio_fingerprint_index_service: AudioFingerprintIndexService) -> None:
        self.audio_fingerprint_index_service = audio_fingerprint_index_service

    async def execute(self, command: UpdateSoundStatusCommand) -> AudioSoundStatusResponse:
        return await self.audio_fingerprint_index_service.update_sound_status(command.request)
