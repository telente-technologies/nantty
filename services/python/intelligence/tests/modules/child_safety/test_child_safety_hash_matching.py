import base64
import hashlib
import json
import logging
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from src.configs.settings_config import IntelligenceSettings
from src.modules.child_safety.dtos.child_safety_dto import MediaScanRequest
from src.modules.child_safety.services.child_safety_signal_service import is_suspected_child_safety
from src.modules.child_safety.services.hash_match_provider_interface_service import (
    DisabledHashMatchProvider,
    HashMatchProviderMisconfiguredError,
    HashMatchUnavailableError,
    HttpHashListMatchProvider,
    SyntheticSha256HashMatchProvider,
    build_hash_match_provider,
)
from src.modules.child_safety.services.media_child_safety_scan_service import MediaChildSafetyScanService
from src.modules.content_scoring.services.image_moderation_interface_service import ImageModerationModelHolder
from src.modules.live_safety.services.csam_hash_match_interface_service import build_live_frame_hash_matcher
from src.modules.live_safety.services.live_safety_scoring_service import LiveSafetyScoringService
from src.modules.live_safety.services.rekognition_image_moderation_model_service import RekognitionImageModerationModel
from src.modules.live_safety.services.transcribe_batch_transcription_service import DisabledSegmentTranscriber
from src.modules.live_safety.services.transcript_moderation_scorer_service import TranscriptModerationScorer
from src.modules.moderation.services.content_moderation_service import ContentModerationService
from src.modules.moderation.services.moderation_model_interface_service import ModerationModelHolder
from tests.conftest import TEST_SHARED_SECRET

FIXTURES = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 10, 17, 9, 0, tzinfo=UTC)
FRAME_KEY = "live-safety/frames/l9/frame_7.jpeg"
DEPLOYED_SECRETS: dict[str, Any] = {
    "shared_secret": "s" * 40,
    "model_signing_secret": "m" * 40,
    "redis_url": "redis://cache:6379/0",
    "rabbitmq_url": "amqp://bus:5672",
}


def fixture(name: str) -> dict[str, Any]:
    loaded: dict[str, Any] = json.loads((FIXTURES / name).read_text())
    return loaded


class FixtureRekognitionClient:
    def __init__(self, labels_fixture: str, faces_fixture: str | None = None) -> None:
        self.labels = fixture(labels_fixture)
        self.faces = fixture(faces_fixture) if faces_fixture else {"FaceDetails": []}
        self.face_calls = 0

    def detect_moderation_labels(self, **_kwargs: Any) -> dict[str, Any]:
        return self.labels

    def detect_faces(self, **_kwargs: Any) -> dict[str, Any]:
        self.face_calls += 1
        return self.faces


class ExplodingRekognitionClient:
    def detect_moderation_labels(self, **_kwargs: Any) -> dict[str, Any]:
        raise AssertionError("hash-matched media must never reach other processors")

    def detect_faces(self, **_kwargs: Any) -> dict[str, Any]:
        raise AssertionError("hash-matched media must never reach other processors")


class UnavailableHashProvider:
    name = "unreachable"
    enabled = True

    def match_image(self, _data: bytes) -> None:
        raise HashMatchUnavailableError("down")

    def match_known_digest(self, _sha256_hex: str) -> None:
        raise HashMatchUnavailableError("down")


class RecordingPublisher:
    delivers = True

    def __init__(self) -> None:
        self.messages: list[Any] = []

    async def publish_live_safety_score(self, message: Any) -> None:
        self.messages.append(message)


def holder_with(client: Any | None) -> ImageModerationModelHolder:
    holder = ImageModerationModelHolder()
    if client is not None:
        holder.register_model(RekognitionImageModerationModel(client))
    return holder


def scan_request(frames: list[bytes], original_sha256: str | None = None) -> MediaScanRequest:
    return MediaScanRequest.model_validate(
        {
            "mediaId": "0192f3a0-0000-7000-8000-00000000c5a1",
            "ownerId": "0192f3a0-0000-7000-8000-00000000c5a2",
            "purpose": "post",
            "kind": "image",
            "originalSha256": original_sha256,
            "frames": [{"mimeType": "image/jpeg", "dataBase64": base64.b64encode(frame).decode()} for frame in frames],
        }
    )


def test_hash_matching_fails_closed_at_startup_when_enabled_but_misconfigured_in_production() -> None:
    with pytest.raises(ValidationError, match="provider name, endpoint or api key"):
        IntelligenceSettings(environment="production", child_safety_hash_provider="http", **DEPLOYED_SECRETS)
    with pytest.raises(ValidationError, match="provider name, endpoint or api key"):
        IntelligenceSettings(
            environment="production",
            child_safety_hash_provider="http",
            child_safety_hash_provider_name="photodna",
            child_safety_hash_provider_endpoint="http://plaintext.example",
            child_safety_hash_provider_api_key="k" * 32,
            **DEPLOYED_SECRETS,
        )
    with pytest.raises(ValidationError, match="test double"):
        IntelligenceSettings(environment="production", child_safety_hash_provider="synthetic", **DEPLOYED_SECRETS)
    with pytest.raises(ValidationError, match="CSAM hash matching is enabled"):
        IntelligenceSettings(
            environment="test",
            shared_secret=TEST_SHARED_SECRET,
            live_safety_csam_hash_matching_enabled=True,
        )
    with pytest.raises(HashMatchProviderMisconfiguredError):
        build_hash_match_provider("http", "production", "safer", "https://hashes.example", "short")
    with pytest.raises(HashMatchProviderMisconfiguredError):
        build_hash_match_provider("synthetic", "staging", synthetic_hashes=hashlib.sha256(os.urandom(8)).hexdigest())
    assert isinstance(build_hash_match_provider("disabled", "production"), DisabledHashMatchProvider)
    configured = build_hash_match_provider("http", "production", "photodna", "https://hashes.example", "k" * 32)
    assert isinstance(configured, HttpHashListMatchProvider)


def test_an_unreachable_provider_raises_instead_of_silently_passing() -> None:
    provider = HttpHashListMatchProvider("photodna", "http://127.0.0.1:9", "k" * 32, 0.2)
    with pytest.raises(HashMatchUnavailableError):
        provider.match_image(os.urandom(64))


def test_the_test_double_matches_only_configured_synthetic_hashes() -> None:
    flagged, innocent = os.urandom(256), os.urandom(256)
    provider = build_hash_match_provider(
        "synthetic", "test", synthetic_hashes=hashlib.sha256(flagged).hexdigest().upper()
    )
    assert isinstance(provider, SyntheticSha256HashMatchProvider)
    match = provider.match_image(flagged)
    assert match is not None
    assert match.provider == "synthetic-sha256"
    assert provider.match_image(innocent) is None
    assert provider.match_known_digest(hashlib.sha256(flagged).hexdigest()) == match
    with pytest.raises(HashMatchProviderMisconfiguredError):
        build_hash_match_provider("synthetic", "test", synthetic_hashes="not-a-digest")


def test_a_hash_match_on_upload_blocks_without_reaching_rekognition_and_logs_nothing_identifying(
    caplog: pytest.LogCaptureFixture,
) -> None:
    flagged_original, frame = os.urandom(512), os.urandom(128)
    digest = hashlib.sha256(flagged_original).hexdigest()
    service = MediaChildSafetyScanService(
        holder_with(ExplodingRekognitionClient()), SyntheticSha256HashMatchProvider(frozenset({digest}))
    )
    request = scan_request([frame], digest)
    with caplog.at_level(logging.DEBUG):
        response = service.scan_media(request, NOW)
    assert response.child_safety.blocked is True
    assert response.child_safety.signal == "hash_match"
    assert response.child_safety.hash_check == "matched"
    assert response.suggested_action == "block"
    logged = " ".join(f"{record.getMessage()} {record.__dict__}" for record in caplog.records)
    assert caplog.records
    for secret in (digest, digest[:16], request.media_id, str(request.owner_id), request.frames[0].data_base64[:24]):
        assert secret not in logged


def test_an_unavailable_hash_check_on_upload_never_answers_allow() -> None:
    service = MediaChildSafetyScanService(holder_with(None), UnavailableHashProvider())
    response = service.scan_media(scan_request([os.urandom(64)]), NOW)
    assert response.child_safety.blocked is False
    assert response.child_safety.hash_check == "unavailable"
    assert response.suggested_action == "review"


@pytest.mark.parametrize(
    ("labels", "faces", "expected"),
    [
        ("rekognition_explicit_frame.json", "rekognition_faces_minor_age_range.json", True),
        ("rekognition_explicit_frame.json", "rekognition_faces_adult_age_range.json", False),
        ("rekognition_explicit_frame.json", "rekognition_faces_low_confidence_minor.json", False),
        ("rekognition_suggestive_only.json", "rekognition_faces_minor_age_range.json", False),
    ],
)
def test_explicit_label_plus_a_face_whose_age_range_tops_out_under_18_is_suspected(
    labels: str, faces: str, expected: bool
) -> None:
    model = RekognitionImageModerationModel(FixtureRekognitionClient(labels))
    detected = model.detect_labels_from_bytes(os.urandom(32))
    assert is_suspected_child_safety(detected, fixture(faces)) is expected


def test_suspected_minor_explicit_upload_is_blocked_and_faces_are_only_checked_for_explicit_frames() -> None:
    explicit = FixtureRekognitionClient("rekognition_explicit_frame.json", "rekognition_faces_minor_age_range.json")
    response = MediaChildSafetyScanService(holder_with(explicit), DisabledHashMatchProvider()).scan_media(
        scan_request([os.urandom(64)]), NOW
    )
    assert response.child_safety.blocked is True
    assert response.child_safety.signal == "suspected_minor_explicit"
    assert response.child_safety.hash_check == "disabled"
    suggestive = FixtureRekognitionClient("rekognition_suggestive_only.json", "rekognition_faces_minor_age_range.json")
    calm = MediaChildSafetyScanService(holder_with(suggestive), DisabledHashMatchProvider()).scan_media(
        scan_request([os.urandom(64)]), NOW
    )
    assert calm.child_safety.blocked is False
    assert suggestive.face_calls == 0


def live_scoring(client: Any, hash_matcher: Any) -> tuple[LiveSafetyScoringService, RecordingPublisher]:
    publisher = RecordingPublisher()
    return LiveSafetyScoringService(
        holder_with(client),
        TranscriptModerationScorer(ContentModerationService(ModerationModelHolder())),
        DisabledSegmentTranscriber(),
        hash_matcher,
        publisher,
    ), publisher


def frame_body() -> str:
    return json.dumps(
        {
            "id": "f7",
            "type": "liveFrame.captured",
            "payload": {
                "frameId": "f7",
                "liveId": "0192f3a0-0000-7000-8000-0000000000l9",
                "hostId": "0192f3a0-0000-7000-8000-000000000002",
                "bucket": "frames-bucket",
                "frameRef": FRAME_KEY,
                "capturedAt": "2026-10-17T08:59:58Z",
            },
        }
    )


async def test_live_frames_hash_match_through_the_generic_adapter_without_logging_the_key(
    caplog: pytest.LogCaptureFixture,
) -> None:
    flagged = os.urandom(300)
    matcher = build_live_frame_hash_matcher(
        SyntheticSha256HashMatchProvider(frozenset({hashlib.sha256(flagged).hexdigest()})),
        lambda _bucket, _key: flagged,
    )
    service, publisher = live_scoring(ExplodingRekognitionClient(), matcher)
    with caplog.at_level(logging.DEBUG):
        assert await service.process_job_body(frame_body(), NOW) == "scored"
    assert publisher.messages[0].hash_match is True
    assert FRAME_KEY not in " ".join(f"{record.getMessage()} {record.__dict__}" for record in caplog.records)


async def test_live_frames_with_explicit_labels_and_a_minor_face_are_held_as_child_safety() -> None:
    client = FixtureRekognitionClient("rekognition_explicit_frame.json", "rekognition_faces_minor_age_range.json")
    service, publisher = live_scoring(client, build_live_frame_hash_matcher(DisabledHashMatchProvider(), None))
    assert await service.process_job_body(frame_body(), NOW) == "scored"
    message = publisher.messages[0]
    assert message.child_safety_suspected is True
    assert message.categories[0].category == "child_safety"
    assert message.suggested_action == "hold"
    assert message.hash_match is False


async def test_live_frames_still_get_reviewed_when_the_hash_check_is_down() -> None:
    client = FixtureRekognitionClient("rekognition_suggestive_only.json")
    unreadable = build_live_frame_hash_matcher(SyntheticSha256HashMatchProvider(frozenset()), None)
    service, publisher = live_scoring(client, unreadable)
    assert await service.process_job_body(frame_body(), NOW) == "scored"
    assert publisher.messages[0].suggested_action in {"review", "hold"}
