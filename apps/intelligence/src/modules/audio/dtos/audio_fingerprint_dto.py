import base64
import binascii
from typing import Literal, Self

from pydantic import AwareDatetime, Field, model_validator

from src.dtos.common_dto import ContractModel
from src.validators.common_field_validator import OpaqueIdentifier, UnitInterval

MAXIMUM_EXCERPT_SECONDS = 30
MINIMUM_EXCERPT_SECONDS = 3
PCM_BYTES_PER_SECOND = 8000 * 2
MAXIMUM_BASE64_LENGTH = (MAXIMUM_EXCERPT_SECONDS * PCM_BYTES_PER_SECOND * 4) // 3 + 8


class PcmAudioExcerpt(ContractModel):
    encoding: Literal["s16le"] = "s16le"
    sample_rate_hz: Literal[8000] = 8000
    channels: Literal[1] = 1
    data_base64: str = Field(min_length=4, max_length=MAXIMUM_BASE64_LENGTH)

    @model_validator(mode="after")
    def require_valid_base64_within_duration_limits(self) -> Self:
        try:
            decoded = base64.b64decode(self.data_base64, validate=True)
        except (binascii.Error, ValueError) as decode_error:
            raise ValueError("dataBase64 is not valid base64") from decode_error
        if len(decoded) % 2 != 0:
            raise ValueError("pcm must contain whole 16-bit samples")
        seconds = len(decoded) / PCM_BYTES_PER_SECOND
        if seconds < MINIMUM_EXCERPT_SECONDS or seconds > MAXIMUM_EXCERPT_SECONDS:
            raise ValueError("excerpt must be between 3 and 30 seconds")
        return self

    def decode_pcm_bytes(self) -> bytes:
        return base64.b64decode(self.data_base64, validate=True)


class AudioFingerprintRegistrationRequest(ContractModel):
    sound_id: OpaqueIdentifier
    excerpt_start_seconds: float = Field(default=0.0, ge=0.0, le=3600.0)
    registered_at: AwareDatetime
    is_verified_original: bool = False
    audio: PcmAudioExcerpt


class AudioMatchRequest(ContractModel):
    audio: PcmAudioExcerpt
    excluded_sound_ids: list[OpaqueIdentifier] = Field(default_factory=list, max_length=100)
    minimum_confidence: UnitInterval = 0.05
    limit: int = Field(default=5, ge=1, le=20)


class AudioSoundStatusUpdateRequest(ContractModel):
    sound_id: OpaqueIdentifier
    is_verified_original: bool | None = None
    is_flagged_copyright: bool | None = None


class AudioMatch(ContractModel):
    sound_id: str
    confidence: float
    aligned_landmark_count: int
    matched_position_seconds: float
    registered_at: AwareDatetime | None
    is_verified_original: bool
    is_flagged_copyright: bool


class AudioMatchResponse(ContractModel):
    matches: list[AudioMatch]
    query_landmark_count: int
    earliest_verified_sound_id: str | None
    any_flagged_match: bool
    algorithm_version: int


class AudioFingerprintRegistrationResponse(ContractModel):
    sound_id: str
    landmark_count: int
    duration_seconds: float
    matches_before_registration: AudioMatchResponse


class AudioSoundStatusResponse(ContractModel):
    sound_id: str
    is_verified_original: bool
    is_flagged_copyright: bool
