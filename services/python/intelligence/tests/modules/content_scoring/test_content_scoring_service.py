import json
from datetime import UTC, datetime
from typing import Any, cast

from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.integrations.rabbitmq_channel_integration import RabbitMqChannelProvider
from src.modules.content_scoring.dtos.content_score_dto import ContentScoreMessage, ImageModerationRequest
from src.modules.content_scoring.repositories.content_score_queue_repository import AmqpContentScorePublisher
from src.modules.content_scoring.services.content_scoring_service import ContentScoringService
from src.modules.content_scoring.services.image_moderation_interface_service import (
    PLACEHOLDER_IMAGE_MODEL_VERSION,
    ImageModerationModelHolder,
    ImageModerationService,
)
from src.modules.moderation.services.content_moderation_service import ContentModerationService
from src.modules.moderation.services.moderation_model_interface_service import ModerationModelHolder
from src.repositories.online_feature_keyspace_repository import OnlineFeatureKeyspace

NOW = datetime(2026, 10, 4, 9, 0, tzinfo=UTC)


class RecordingPublisher:
    delivers = True

    def __init__(self) -> None:
        self.messages: list[ContentScoreMessage] = []

    async def publish_content_score(self, message: ContentScoreMessage) -> None:
        self.messages.append(message)


class AlwaysNudityModel:
    version = "image-test-v1"

    def classify_image(self, _request: ImageModerationRequest) -> dict[str, float]:
        return {"nudity": 0.91}


def build_service(
    image_holder: ImageModerationModelHolder | None = None,
) -> tuple[ContentScoringService, RecordingPublisher]:
    publisher = RecordingPublisher()
    service = ContentScoringService(
        ContentModerationService(ModerationModelHolder()),
        ImageModerationService(image_holder or ImageModerationModelHolder()),
        publisher,
        InMemoryFeatureBackend(),
        OnlineFeatureKeyspace("test"),
    )
    return service, publisher


async def test_created_posts_publish_an_advisory_score_in_the_go_trust_contract() -> None:
    service, publisher = build_service()
    message = await service.score_created_post(
        "post-1", "author-1", "clip", "Send me your bank PIN to claim a prize", ["media-1"], NOW
    )
    assert message is not None
    assert publisher.messages == [message]
    body = json.loads(message.model_dump_json(by_alias=True))
    assert set(body) == {
        "scoreId",
        "targetType",
        "targetId",
        "ownerId",
        "score",
        "suggestedAction",
        "categories",
        "modelVersion",
        "advisoryOnly",
        "generatedAt",
    }
    assert body["targetType"] == "clip"
    assert body["targetId"] == "post-1"
    assert body["ownerId"] == "author-1"
    assert body["advisoryOnly"] is True
    assert all(set(category) == {"category", "score"} for category in body["categories"])


async def test_posts_without_text_and_placeholder_image_scores_never_publish() -> None:
    service, publisher = build_service()
    assert await service.score_created_post("post-2", "author-2", "post", "   ", ["media-2"], NOW) is None
    assert await service.score_processed_media("media-2", "author-2", "post", NOW) is None
    assert await service.score_processed_media("unknown-media", "author-2", "post", NOW) is None
    assert publisher.messages == []


async def test_a_registered_image_model_scores_the_post_behind_the_processed_media() -> None:
    holder = ImageModerationModelHolder()
    holder.register_model(AlwaysNudityModel())
    service, publisher = build_service(holder)
    await service.score_created_post("post-3", "author-3", "post", "", ["media-3"], NOW)
    message = await service.score_processed_media("media-3", "author-3", "post", NOW)
    assert message is not None
    assert message.target_id == "post-3"
    assert message.suggested_action == "block"
    assert publisher.messages[0].model_version == "image-test-v1"


def test_the_placeholder_image_model_reports_no_signal_and_never_blocks() -> None:
    response = ImageModerationService(ImageModerationModelHolder()).classify_image(
        ImageModerationRequest(media_id="m-1", frame_index=3), NOW
    )
    assert response.no_signal
    assert response.suggested_action == "allow"
    assert response.score == 0.0
    assert response.model_version == PLACEHOLDER_IMAGE_MODEL_VERSION
    assert response.advisory_only is True


class FakeExchange:
    def __init__(self) -> None:
        self.published: list[tuple[Any, str]] = []

    async def publish(self, message: Any, routing_key: str, *, mandatory: bool = True) -> None:
        assert mandatory
        self.published.append((message, routing_key))


class FakeChannelProvider:
    def __init__(self) -> None:
        self.exchange = FakeExchange()

    async def channel_for_publishing(self) -> Any:
        provider = self

        class Channel:
            async def get_exchange(self, name: str, *, ensure: bool = True) -> FakeExchange:
                assert name == "zudomart.jobs"
                assert ensure is False
                return provider.exchange

        return Channel()


async def test_scores_are_routed_to_the_content_scores_job_queue() -> None:
    provider = FakeChannelProvider()
    publisher = AmqpContentScorePublisher(cast(RabbitMqChannelProvider, provider), "intelligence-trust-content-scores")
    service, _ = build_service()
    message = await service.score_created_post("post-4", "author-4", "post", "hello friends", [], NOW)
    assert message is not None
    await publisher.publish_content_score(message)
    sent, routing_key = provider.exchange.published[0]
    assert routing_key == "intelligence-trust-content-scores"
    assert sent.message_id == message.score_id


class ExplodingImageModel:
    version = "image-test-exploding-v1"

    def classify_image(self, _request: ImageModerationRequest) -> dict[str, float]:
        raise RuntimeError("rekognition down")


def test_failing_image_model_floors_the_action_at_review_with_unavailable_version() -> None:
    holder = ImageModerationModelHolder()
    holder.register_model(ExplodingImageModel())
    service = ImageModerationService(holder)
    response = service.classify_image(ImageModerationRequest(media_id="media-9"))
    assert response.suggested_action == "review"
    assert response.model_version == "unavailable"
    assert response.no_signal is True
