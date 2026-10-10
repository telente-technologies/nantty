import base64
from collections.abc import Sequence
from datetime import datetime, timedelta
from unittest.mock import patch

import numpy as np
import numpy.typing as npt
import pytest

from src.container import ApplicationContainer
from src.interfaces.feature_backend_interface import FeatureWriteOperation
from src.modules.audio.dtos.audio_fingerprint_dto import (
    AudioFingerprintRegistrationRequest,
    AudioMatchRequest,
    AudioSoundStatusUpdateRequest,
)
from src.modules.audio.services.audio_fingerprint_index_service import (
    EXCERPT_CLAIM_RETENTION_SECONDS,
    AudioFingerprintIndexService,
    AudioSoundAlreadyRegisteredError,
)
from tests.conftest import SignedIntelligenceClient

SAMPLE_RATE_HZ = 8000


def synthesize_chord_melody(seed: int, duration_seconds: float) -> npt.NDArray[np.float64]:
    random_generator = np.random.default_rng(seed)
    chord_length_seconds = 0.4
    chord_count = int(np.ceil(duration_seconds / chord_length_seconds))
    time_axis = np.arange(int(chord_length_seconds * SAMPLE_RATE_HZ)) / SAMPLE_RATE_HZ
    chords = []
    for _chord in range(chord_count):
        frequencies = random_generator.uniform(200.0, 3500.0, size=3)
        amplitudes = random_generator.uniform(0.2, 0.5, size=3)
        chord = sum(
            amplitude * np.sin(2 * np.pi * frequency * time_axis)
            for frequency, amplitude in zip(frequencies, amplitudes, strict=True)
        )
        chords.append(np.asarray(chord) * np.hanning(time_axis.size) ** 0.25)
    melody = np.concatenate(chords)[: int(duration_seconds * SAMPLE_RATE_HZ)]
    return melody + random_generator.normal(0, 0.01, melody.size)


def encode_waveform_as_pcm_base64(waveform: npt.NDArray[np.float64]) -> str:
    peak = max(float(np.max(np.abs(waveform))), 1e-9)
    scaled = waveform / peak * 0.9 if peak > 1.0 else waveform
    pcm = np.clip(scaled * 32767, -32768, 32767).astype("<i2").tobytes()
    return base64.b64encode(pcm).decode("ascii")


def build_registration(
    sound_id: str, waveform: npt.NDArray[np.float64], registered_at: datetime, verified: bool
) -> AudioFingerprintRegistrationRequest:
    return AudioFingerprintRegistrationRequest.model_validate(
        {
            "soundId": sound_id,
            "registeredAt": registered_at.isoformat(),
            "isVerifiedOriginal": verified,
            "audio": {"dataBase64": encode_waveform_as_pcm_base64(waveform)},
        }
    )


def build_match_request(waveform: npt.NDArray[np.float64]) -> AudioMatchRequest:
    return AudioMatchRequest.model_validate({"audio": {"dataBase64": encode_waveform_as_pcm_base64(waveform)}})


async def test_identical_excerpt_matches_itself_with_high_confidence(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    index = AudioFingerprintIndexService(application_container.feature_store)
    song = synthesize_chord_melody(1, 12)
    registration = await index.register_sound(build_registration("sound_a", song, reference_now, verified=True))
    assert registration.landmark_count > 100
    response = await index.match_audio(build_match_request(song))
    assert response.matches[0].sound_id == "sound_a"
    assert response.matches[0].confidence > 0.5
    assert response.matches[0].matched_position_seconds < 0.1


async def test_time_shifted_excerpt_matches_with_correct_position(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    index = AudioFingerprintIndexService(application_container.feature_store)
    song = synthesize_chord_melody(2, 24)
    await index.register_sound(build_registration("sound_long", song, reference_now, verified=True))
    excerpt = song[6 * SAMPLE_RATE_HZ + 1234 : 14 * SAMPLE_RATE_HZ]
    response = await index.match_audio(build_match_request(excerpt))
    assert response.matches[0].sound_id == "sound_long"
    expected_position_seconds = (6 * SAMPLE_RATE_HZ + 1234) / SAMPLE_RATE_HZ
    assert abs(response.matches[0].matched_position_seconds - expected_position_seconds) < 0.1


async def test_quieter_noisy_copy_still_matches_original(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    index = AudioFingerprintIndexService(application_container.feature_store)
    song = synthesize_chord_melody(3, 15)
    await index.register_sound(build_registration("sound_original", song, reference_now, verified=True))
    await index.register_sound(
        build_registration("sound_other", synthesize_chord_melody(30, 15), reference_now, verified=True)
    )
    noise = np.random.default_rng(99).normal(0, np.std(song) * 0.3, song.size)
    degraded_copy = 0.25 * (song + noise)
    response = await index.match_audio(build_match_request(degraded_copy))
    assert response.matches[0].sound_id == "sound_original"
    assert response.matches[0].confidence > 0.1
    assert all(match.sound_id != "sound_other" for match in response.matches)


async def test_unrelated_audio_returns_no_matches(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    index = AudioFingerprintIndexService(application_container.feature_store)
    await index.register_sound(
        build_registration("sound_x", synthesize_chord_melody(4, 12), reference_now, verified=True)
    )
    response = await index.match_audio(build_match_request(synthesize_chord_melody(5, 12)))
    assert response.matches == []
    assert response.earliest_verified_sound_id is None


async def test_reupload_reports_earliest_verified_owner_and_copyright_flag(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    index = AudioFingerprintIndexService(application_container.feature_store)
    song = synthesize_chord_melody(6, 12)
    await index.register_sound(
        build_registration("sound_first", song, reference_now - timedelta(days=3), verified=True)
    )
    reupload = await index.register_sound(build_registration("sound_copy", song * 0.5, reference_now, verified=False))
    assert reupload.matches_before_registration.matches[0].sound_id == "sound_first"
    assert reupload.matches_before_registration.earliest_verified_sound_id == "sound_first"
    status = await index.update_sound_status(
        AudioSoundStatusUpdateRequest(sound_id="sound_first", is_flagged_copyright=True)
    )
    assert status.is_flagged_copyright
    assert status.is_verified_original
    response = await index.match_audio(build_match_request(song))
    assert {match.sound_id for match in response.matches} == {"sound_first", "sound_copy"}
    assert response.any_flagged_match
    assert response.earliest_verified_sound_id == "sound_first"


async def test_audio_endpoints_enforce_conflicts_and_validation(
    signed_client: SignedIntelligenceClient, reference_now: datetime
) -> None:
    song_base64 = encode_waveform_as_pcm_base64(synthesize_chord_melody(7, 6))
    registration = {
        "soundId": "sound_http",
        "registeredAt": reference_now.isoformat(),
        "audio": {"dataBase64": song_base64},
    }
    first = await signed_client.post("/v1/audio/fingerprints", registration)
    assert first.status_code == 200
    assert first.json()["landmarkCount"] > 0
    duplicate = await signed_client.post("/v1/audio/fingerprints", registration)
    assert duplicate.status_code == 409
    silent = base64.b64encode(np.zeros(8000 * 4, dtype="<i2").tobytes()).decode("ascii")
    silent_response = await signed_client.post("/v1/audio/match", {"audio": {"dataBase64": silent}})
    assert silent_response.status_code == 422
    too_short = base64.b64encode(np.ones(8000, dtype="<i2").tobytes()).decode("ascii")
    assert (await signed_client.post("/v1/audio/match", {"audio": {"dataBase64": too_short}})).status_code == 422
    assert (await signed_client.post("/v1/audio/match", {"audio": {"dataBase64": "not base64!!"}})).status_code == 422
    wrong_rate = {"audio": {"dataBase64": song_base64, "sampleRateHz": 44100}}
    assert (await signed_client.post("/v1/audio/match", wrong_rate)).status_code == 422
    missing = await signed_client.post(
        "/v1/audio/sounds/status", {"soundId": "sound_missing", "isFlaggedCopyright": True}
    )
    assert missing.status_code == 404
    matched = await signed_client.post("/v1/audio/match", {"audio": {"dataBase64": song_base64}})
    assert matched.json()["matches"][0]["soundId"] == "sound_http"


async def test_long_sound_can_be_registered_as_several_excerpts(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    index = AudioFingerprintIndexService(application_container.feature_store)
    song = synthesize_chord_melody(8, 50)
    first_excerpt = build_registration("sound_long_mix", song[: 25 * SAMPLE_RATE_HZ], reference_now, verified=True)
    second_payload = first_excerpt.model_dump(by_alias=True, mode="json")
    second_payload["excerptStartSeconds"] = 25.0
    second_payload["audio"]["dataBase64"] = encode_waveform_as_pcm_base64(song[25 * SAMPLE_RATE_HZ :])
    await index.register_sound(first_excerpt)
    await index.register_sound(AudioFingerprintRegistrationRequest.model_validate(second_payload))
    with pytest.raises(AudioSoundAlreadyRegisteredError):
        await index.register_sound(first_excerpt)
    response = await index.match_audio(build_match_request(song[33 * SAMPLE_RATE_HZ : 41 * SAMPLE_RATE_HZ]))
    assert response.matches[0].sound_id == "sound_long_mix"
    assert abs(response.matches[0].matched_position_seconds - 33.0) < 0.1


async def test_failed_registration_releases_the_excerpt_claim_for_retry(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    assert EXCERPT_CLAIM_RETENTION_SECONDS <= 15 * 60
    index = AudioFingerprintIndexService(application_container.feature_store)
    backend = application_container.feature_store.feature_backend
    song = synthesize_chord_melody(9, 12)
    registration = build_registration("sound_retry_mix", song, reference_now, verified=True)
    original_apply = backend.apply_write_operations
    calls = 0

    async def fail_once(operations: Sequence[FeatureWriteOperation]) -> None:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise RuntimeError("boom")
        await original_apply(operations)

    with patch.object(backend, "apply_write_operations", fail_once), pytest.raises(RuntimeError):
        await index.register_sound(registration)
    response = await index.register_sound(registration)
    assert response.sound_id == "sound_retry_mix"
