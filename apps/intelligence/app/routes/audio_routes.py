from fastapi import APIRouter, HTTPException

from app.models.audio_fingerprint_model import (
    AudioFingerprintRegistrationRequest,
    AudioFingerprintRegistrationResponse,
    AudioMatchRequest,
    AudioMatchResponse,
    AudioSoundStatusResponse,
    AudioSoundStatusUpdateRequest,
)
from app.routes.route_dependencies import ContainerDependency, run_within_request_deadline
from app.services.audio_fingerprint_index_service import (
    AudioFingerprintIndexService,
    AudioSoundAlreadyRegisteredError,
    AudioSoundNotFoundError,
)
from app.services.audio_landmark_fingerprint_service import AudioTooQuietOrShortError
from app.stores.feature_backend_protocol import FeatureBackendUnavailableError

AUDIO_REQUEST_DEADLINE_SECONDS = 3.0
audio_router = APIRouter(prefix="/v1/audio", tags=["audio"])


def build_audio_index_service(container: ContainerDependency) -> AudioFingerprintIndexService:
    return AudioFingerprintIndexService(container.feature_store)


@audio_router.post("/fingerprints", response_model=AudioFingerprintRegistrationResponse)
async def register_audio_fingerprint_route(
    request: AudioFingerprintRegistrationRequest, container: ContainerDependency
) -> AudioFingerprintRegistrationResponse:
    try:
        return await run_within_request_deadline(
            build_audio_index_service(container).register_sound(request), container, AUDIO_REQUEST_DEADLINE_SECONDS
        )
    except AudioSoundAlreadyRegisteredError as conflict:
        raise HTTPException(status_code=409, detail="sound_already_registered") from conflict
    except AudioTooQuietOrShortError as unusable_audio:
        raise HTTPException(status_code=422, detail="audio_unusable_for_fingerprinting") from unusable_audio
    except FeatureBackendUnavailableError as backend_error:
        raise HTTPException(status_code=503, detail="fingerprint_store_unavailable") from backend_error


@audio_router.post("/match", response_model=AudioMatchResponse)
async def match_audio_route(request: AudioMatchRequest, container: ContainerDependency) -> AudioMatchResponse:
    try:
        return await run_within_request_deadline(
            build_audio_index_service(container).match_audio(request), container, AUDIO_REQUEST_DEADLINE_SECONDS
        )
    except AudioTooQuietOrShortError as unusable_audio:
        raise HTTPException(status_code=422, detail="audio_unusable_for_fingerprinting") from unusable_audio
    except FeatureBackendUnavailableError as backend_error:
        raise HTTPException(status_code=503, detail="fingerprint_store_unavailable") from backend_error


@audio_router.post("/sounds/status", response_model=AudioSoundStatusResponse)
async def update_sound_status_route(
    request: AudioSoundStatusUpdateRequest, container: ContainerDependency
) -> AudioSoundStatusResponse:
    try:
        return await build_audio_index_service(container).update_sound_status(request)
    except AudioSoundNotFoundError as missing:
        raise HTTPException(status_code=404, detail="sound_not_registered") from missing
    except FeatureBackendUnavailableError as backend_error:
        raise HTTPException(status_code=503, detail="fingerprint_store_unavailable") from backend_error
