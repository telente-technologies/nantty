from fastapi import APIRouter

from src.modules.audio.controllers.audio_controller import AudioController
from src.modules.audio.dtos.audio_fingerprint_dto import (
    AudioFingerprintRegistrationResponse,
    AudioMatchResponse,
    AudioSoundStatusResponse,
)
from src.modules.audio.dtos.copyright_audio_match_dto import CopyrightAudioMatchResponse


def build_audio_router(controller: AudioController) -> APIRouter:
    router = APIRouter(prefix="/v1/audio", tags=["audio"])
    router.add_api_route(
        "/fingerprints",
        controller.register_fingerprint,
        methods=["POST"],
        response_model=AudioFingerprintRegistrationResponse,
    )
    router.add_api_route("/match", controller.match_excerpt, methods=["POST"], response_model=AudioMatchResponse)
    router.add_api_route(
        "/sounds/status", controller.update_sound_status, methods=["POST"], response_model=AudioSoundStatusResponse
    )
    router.add_api_route(
        "/copyright-matches",
        controller.match_copyright_audio,
        methods=["POST"],
        response_model=CopyrightAudioMatchResponse,
    )
    return router
