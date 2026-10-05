import json
from datetime import UTC, datetime

from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.events.contract_envelope_normalizer import normalize_contract_envelope
from src.events.domain_event_dto import MediaProcessedDomainEvent, domain_event_type_adapter
from src.modules.content_scoring.dtos.content_score_dto import ContentScoreMessage, ImageModerationRequest
from src.modules.content_scoring.dtos.sensitivity_advisory_dto import SensitivityAdvisedEvent
from src.modules.content_scoring.services.content_scoring_service import ContentScoringService
from src.modules.content_scoring.services.image_moderation_interface_service import (
    ImageModerationModelHolder,
    ImageModerationService,
)
from src.modules.moderation.services.content_moderation_service import ContentModerationService
from src.modules.moderation.services.moderation_model_interface_service import ModerationModelHolder
from src.repositories.online_feature_keyspace_repository import OnlineFeatureKeyspace

NOW = datetime(2026, 10, 4, 9, 0, tzinfo=UTC)


class RecordingScorePublisher:
    def __init__(self) -> None:
        self.messages: list[ContentScoreMessage] = []

    async def publish_content_score(self, message: ContentScoreMessage) -> None:
        self.messages.append(message)


class RecordingSensitivityPublisher:
    def __init__(self) -> None:
        self.events: list[SensitivityAdvisedEvent] = []

    async def publish_sensitivity_advisory(self, event: SensitivityAdvisedEvent) -> None:
        self.events.append(event)


class RecordingRekognitionLikeModel:
    version = "aws-rekognition-moderation-test"

    def __init__(self, scores: dict[str, float]) -> None:
        self.scores = scores
        self.requested_urls: list[str | None] = []

    def classify_image(self, request: ImageModerationRequest) -> dict[str, float]:
        self.requested_urls.append(request.image_url)
        return self.scores if request.image_url else {}


async def build_service(
    scores: dict[str, float], bucket: str = "zudomart-media"
) -> tuple[ContentScoringService, RecordingSensitivityPublisher, RecordingRekognitionLikeModel]:
    holder = ImageModerationModelHolder()
    model = RecordingRekognitionLikeModel(scores)
    holder.register_model(model)
    sensitivity = RecordingSensitivityPublisher()
    service = ContentScoringService(
        ContentModerationService(ModerationModelHolder()),
        ImageModerationService(holder),
        RecordingScorePublisher(),
        InMemoryFeatureBackend(),
        OnlineFeatureKeyspace("test"),
        sensitivity,
        bucket,
    )
    await service.remember_post_media("post-9", "author-9", "post", ["media-9"], NOW)
    return service, sensitivity, model


async def test_processed_media_publishes_the_social_sensitivity_contract() -> None:
    service, sensitivity, model = await build_service({"sexual_explicit": 0.93, "gore": 0.4, "drugs": 0.9})
    await service.score_processed_media("media-9", "author-9", "post", NOW, "posts/media-9/1080.jpg")
    assert model.requested_urls == ["s3://zudomart-media/posts/media-9/1080.jpg"]
    assert len(sensitivity.events) == 1
    body = json.loads(sensitivity.events[0].model_dump_json(by_alias=True))
    assert body["type"] == "content.sensitivityAdvised"
    assert body["schemaVersion"] == 1
    assert body["data"]["targetType"] == "post"
    assert body["data"]["targetId"] == "post-9"
    assert body["data"]["advisoryOnly"] is True
    assert body["data"]["modelVersion"] == "aws-rekognition-moderation-test"
    assert body["data"]["scores"] == [{"label": "nudity", "score": 0.93}, {"label": "graphic_violence", "score": 0.4}]
    assert body["data"]["confidence"] == 0.93


async def test_no_signal_without_credentials_or_key_publishes_nothing() -> None:
    service, sensitivity, _model = await build_service({"sexual_explicit": 0.93}, bucket="")
    assert await service.score_processed_media("media-9", "author-9", "post", NOW, "posts/media-9/1080.jpg") is None
    assert sensitivity.events == []


async def test_unmapped_categories_do_not_publish_advice() -> None:
    service, sensitivity, _model = await build_service({"drugs": 0.95})
    await service.score_processed_media("media-9", "author-9", "post", NOW, "posts/media-9/1080.jpg")
    assert sensitivity.events == []


def test_media_processed_contract_envelope_selects_a_rekognition_compatible_key() -> None:
    body = {
        "id": "evt-1",
        "type": "media.processed",
        "schemaVersion": 1,
        "subject": "media-9",
        "occurredAt": NOW.isoformat(),
        "data": {
            "mediaId": "media-9",
            "ownerId": "author-9",
            "purpose": "post",
            "kind": "image",
            "variants": [{"format": "avif", "key": "a.avif"}, {"format": "jpeg", "key": "b.jpg"}],
        },
    }
    event = domain_event_type_adapter.validate_python(normalize_contract_envelope(body))
    assert isinstance(event, MediaProcessedDomainEvent)
    assert event.payload.image_key == "b.jpg"
