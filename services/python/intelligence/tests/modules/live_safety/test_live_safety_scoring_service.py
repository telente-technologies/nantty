import io
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from src.configs.settings_config import IntelligenceSettings
from src.container import ApplicationContainer
from src.modules.content_scoring.dtos.content_score_dto import ImageModerationRequest
from src.modules.content_scoring.services.image_moderation_interface_service import (
    ImageModerationModelHolder,
    NoSignalImageModerationModel,
)
from src.modules.live_safety.dtos.live_safety_dto import CsamHashMatch, LiveSafetyScoreMessage
from src.modules.live_safety.live_safety_module import register_rekognition_when_available
from src.modules.live_safety.services.csam_hash_match_interface_service import (
    CsamHashMatchingNotConfiguredError,
    DisabledCsamHashMatchProvider,
    build_csam_hash_match_provider,
)
from src.modules.live_safety.services.live_safety_scoring_service import LiveSafetyScoringService
from src.modules.live_safety.services.rekognition_image_moderation_model_service import RekognitionImageModerationModel
from src.modules.live_safety.services.transcribe_batch_transcription_service import (
    DisabledSegmentTranscriber,
    TranscribeBatchTranscriber,
)
from src.modules.live_safety.services.transcript_moderation_scorer_service import TranscriptModerationScorer
from src.modules.moderation.services.content_moderation_service import ContentModerationService
from src.modules.moderation.services.moderation_model_interface_service import ModerationModelHolder

from .test_live_safety_label_mapping import RecordedRekognitionClient

NOW = datetime(2026, 10, 4, 12, 0, tzinfo=UTC)
FIXTURES = Path(__file__).parent / "fixtures"
SHARED_SECRET = "test-shared-secret-that-is-long-enough-000"


class RecordingLiveSafetyPublisher:
    delivers = True

    def __init__(self) -> None:
        self.messages: list[LiveSafetyScoreMessage] = []

    async def publish_live_safety_score(self, message: LiveSafetyScoreMessage) -> None:
        self.messages.append(message)


class ExplodingRekognitionClient:
    def detect_moderation_labels(self, **_kwargs: Any) -> dict[str, Any]:
        raise AssertionError("hash-matched frames must never reach other processors")


class AlwaysMatchingHashProvider:
    name = "test-hash-provider"

    def match_frame(self, _bucket: str, _key: str) -> CsamHashMatch | None:
        return CsamHashMatch(provider="test-hash-provider", match_reference="ref-1")


def frame_job_body(job_type: str = "liveFrame.captured") -> str:
    return json.dumps(
        {
            "id": "f1",
            "type": job_type,
            "payload": {
                "frameId": "f1",
                "liveId": "0192f3a0-0000-7000-8000-000000000001",
                "hostId": "0192f3a0-0000-7000-8000-000000000002",
                "bucket": "frames-bucket",
                "frameRef": "live-safety/frames/l1/frame_1.jpeg",
                "capturedAt": "2026-10-04T11:59:58Z",
                "boosted": False,
                "holdActive": False,
            },
        }
    )


def build_scoring(
    image_client: Any | None = None, hash_provider: Any | None = None, transcriber: Any | None = None
) -> tuple[LiveSafetyScoringService, RecordingLiveSafetyPublisher]:
    holder = ImageModerationModelHolder()
    if image_client is not None:
        holder.register_model(RekognitionImageModerationModel(image_client))
    publisher = RecordingLiveSafetyPublisher()
    service = LiveSafetyScoringService(
        holder,
        TranscriptModerationScorer(ContentModerationService(ModerationModelHolder())),
        transcriber or DisabledSegmentTranscriber(),
        hash_provider or DisabledCsamHashMatchProvider(),
        publisher,
    )
    return service, publisher


async def test_a_flagged_frame_publishes_an_advisory_live_safety_score_for_go_trust() -> None:
    service, publisher = build_scoring(RecordedRekognitionClient("rekognition_explicit_nudity_frame.json"))
    assert await service.process_job_body(frame_job_body(), NOW) == "scored"
    body = json.loads(publisher.messages[0].model_dump_json(by_alias=True))
    assert set(body) == {
        "scoreId",
        "liveId",
        "hostId",
        "kind",
        "frameRef",
        "capturedAt",
        "labels",
        "categories",
        "confidence",
        "suggestedAction",
        "modelVersion",
        "transcriptSnippet",
        "hashMatch",
        "hashMatchProvider",
        "hashMatchReference",
        "advisoryOnly",
        "generatedAt",
    }
    assert body["advisoryOnly"] is True
    assert body["suggestedAction"] == "hold"
    assert body["categories"][0] == {"category": "sexual_explicit", "confidence": 0.964}
    assert body["labels"][0] == {"name": "Explicit", "parentName": "", "confidence": 0.9812}
    assert body["modelVersion"] == "aws-rekognition-moderation-7.0"


async def test_no_signal_stays_the_default_and_publishes_nothing() -> None:
    service, publisher = build_scoring()
    assert await service.process_job_body(frame_job_body(), NOW) == "skipped"
    assert publisher.messages == []


async def test_malformed_and_unknown_jobs_are_handled_without_publishing() -> None:
    service, publisher = build_scoring(RecordedRekognitionClient("rekognition_safe_frame.json"))
    assert await service.process_job_body("{", NOW) == "rejected"
    assert (
        await service.process_job_body(
            json.dumps({"id": "x", "type": "liveFrame.captured", "payload": {"frameId": "f1"}}), NOW
        )
        == "rejected"
    )
    assert await service.process_job_body(frame_job_body("somethingElse"), NOW) == "skipped"
    assert publisher.messages == []


async def test_hash_matched_frames_skip_rekognition_and_carry_no_labels() -> None:
    service, publisher = build_scoring(ExplodingRekognitionClient(), AlwaysMatchingHashProvider())
    assert await service.process_job_body(frame_job_body(), NOW) == "scored"
    message = publisher.messages[0]
    assert message.hash_match is True
    assert message.labels == []
    assert message.categories[0].category == "child_safety"
    assert message.hash_match_reference == "ref-1"


def test_csam_hash_matching_is_disabled_by_default_and_refuses_to_enable_without_a_provider() -> None:
    assert isinstance(build_csam_hash_match_provider(False), DisabledCsamHashMatchProvider)
    with pytest.raises(CsamHashMatchingNotConfiguredError):
        build_csam_hash_match_provider(True)


async def test_transcripts_flag_self_harm_speech_for_urgent_review() -> None:
    scorer = TranscriptModerationScorer(ContentModerationService(ModerationModelHolder()))
    categories = await scorer.score_transcript("seg-1", "honestly i just want to end it all tonight", NOW)
    assert categories[0].category == "self_harm"
    assert categories[0].confidence == 0.75


class FakeTranscribe:
    def __init__(self) -> None:
        self.started: list[dict[str, Any]] = []
        self.statuses = ["IN_PROGRESS", "COMPLETED"]

    def start_transcription_job(self, **kwargs: Any) -> dict[str, Any]:
        self.started.append(kwargs)
        return {}

    def get_transcription_job(self, **_kwargs: Any) -> dict[str, Any]:
        return {"TranscriptionJob": {"TranscriptionJobStatus": self.statuses.pop(0)}}


class FakeObjects:
    def get_object(self, **_kwargs: Any) -> dict[str, Any]:
        return {"Body": io.BytesIO((FIXTURES / "transcribe_completed_transcript.json").read_bytes())}


async def test_audio_segments_are_transcribed_then_scored() -> None:
    transcribe = FakeTranscribe()
    transcriber = TranscribeBatchTranscriber(transcribe, FakeObjects(), "transcripts-bucket", poll_seconds=0)
    service, publisher = build_scoring(transcriber=transcriber)
    body = json.dumps(
        {
            "id": "a1",
            "type": "liveAudio.segmentCaptured",
            "payload": {
                "segmentId": "seg-1",
                "liveId": "live-1",
                "hostId": "host-1",
                "bucket": "frames-bucket",
                "segmentRef": "live-safety/audio/live-1/seg_1.ts",
                "capturedAt": "2026-10-04T11:59:30Z",
            },
        }
    )
    assert await service.process_job_body(body, NOW) == "scored"
    assert transcribe.started[0]["Media"] == {"MediaFileUri": "s3://frames-bucket/live-safety/audio/live-1/seg_1.ts"}
    message = publisher.messages[0]
    assert message.kind == "transcript"
    assert message.transcript_snippet.startswith("honestly")
    assert message.categories[0].category == "self_harm"


def test_the_container_keeps_no_signal_when_aws_is_not_configured(application_container: ApplicationContainer) -> None:
    assert isinstance(application_container.image_moderation_model_holder.active_model, NoSignalImageModerationModel)
    assert application_container.live_safety_scoring_service is not None


class FakeSession:
    def __init__(self, has_credentials: bool) -> None:
        self.has_credentials = has_credentials

    def get_credentials(self) -> object | None:
        return object() if self.has_credentials else None

    def client(self, _name: str, **_kwargs: object) -> RecordedRekognitionClient:
        return RecordedRekognitionClient("rekognition_safe_frame.json")


@pytest.mark.parametrize(("has_credentials", "uses_rekognition"), [(True, True), (False, False)])
def test_rekognition_is_registered_only_when_aws_credentials_exist(
    has_credentials: bool, uses_rekognition: bool
) -> None:
    settings = IntelligenceSettings(environment="development", shared_secret=SHARED_SECRET)
    holder = ImageModerationModelHolder()
    register_rekognition_when_available(settings, holder, lambda _region: FakeSession(has_credentials))
    assert isinstance(holder.active_model, RekognitionImageModerationModel) is uses_rekognition
    assert holder.active_model.classify_image(ImageModerationRequest(media_id="m1")) == {}
