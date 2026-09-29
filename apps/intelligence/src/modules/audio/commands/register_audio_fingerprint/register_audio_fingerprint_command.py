from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Command
from src.modules.audio.dtos.audio_fingerprint_dto import AudioFingerprintRegistrationRequest


@dataclass(frozen=True, slots=True)
class RegisterAudioFingerprintCommand(Command):
    command_type: ClassVar[str] = "audio.registerAudioFingerprint"
    request: AudioFingerprintRegistrationRequest
