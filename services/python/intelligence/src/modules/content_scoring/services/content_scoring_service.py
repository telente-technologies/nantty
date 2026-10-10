import asyncio
import hashlib
import logging
from collections.abc import Sequence
from datetime import datetime

from src.interfaces.feature_backend_interface import (
    FeatureBackend,
    FeatureWriteOperation,
    KeyExpiry,
    SortedSetAssignScore,
)
from src.modules.content_scoring.dtos.content_score_dto import (
    ContentScoreCategory,
    ContentScoreMessage,
    ContentScoreTargetType,
    ImageModerationRequest,
)
from src.modules.content_scoring.dtos.sensitivity_advisory_dto import SensitivityAdvisedData, SensitivityAdvisedEvent
from src.modules.content_scoring.repositories.content_score_queue_repository import ContentScorePublisher
from src.modules.content_scoring.repositories.sensitivity_advisory_publisher_repository import (
    NullSensitivityAdvisoryPublisher,
    SensitivityAdvisoryPublisher,
)
from src.modules.content_scoring.services.image_moderation_interface_service import ImageModerationService
from src.modules.content_scoring.services.sensitivity_advisory_mapping_service import (
    map_categories_to_social_sensitive_labels,
)
from src.modules.moderation.dtos.content_moderation_dto import ContentModerationRequest
from src.modules.moderation.services.content_moderation_service import ContentModerationService
from src.repositories.online_feature_keyspace_repository import OnlineFeatureKeyspace

scoring_logger = logging.getLogger("intelligence.content_scoring")
MEDIA_POST_LINK_TTL_SECONDS = 7 * 24 * 3600
MAXIMUM_SCORED_TEXT_LENGTH = 5000
LINK_SEPARATOR = "|"


def build_score_id(*parts: str) -> str:
    return hashlib.sha256(LINK_SEPARATOR.join(parts).encode()).hexdigest()[:32]


class ContentScoringService:
    def __init__(
        self,
        text_moderation: ContentModerationService,
        image_moderation: ImageModerationService,
        publisher: ContentScorePublisher,
        backend: FeatureBackend,
        keyspace: OnlineFeatureKeyspace,
        sensitivity_publisher: SensitivityAdvisoryPublisher | None = None,
        media_bucket: str = "",
    ) -> None:
        self.text_moderation = text_moderation
        self.image_moderation = image_moderation
        self.publisher = publisher
        self.backend = backend
        self.keyspace = keyspace
        self.sensitivity_publisher = sensitivity_publisher or NullSensitivityAdvisoryPublisher()
        self.media_bucket = media_bucket

    async def remember_post_media(
        self, post_id: str, author_id: str, target_type: ContentScoreTargetType, media_ids: Sequence[str], now: datetime
    ) -> None:
        operations: list[FeatureWriteOperation] = []
        for media_id in media_ids:
            key = self.keyspace.media_post_link_key(media_id)
            member = LINK_SEPARATOR.join((post_id, author_id, target_type))
            operations += [
                SortedSetAssignScore(key, member, now.timestamp()),
                KeyExpiry(key, MEDIA_POST_LINK_TTL_SECONDS),
            ]
        if operations:
            await self.backend.apply_write_operations(operations)

    async def score_created_post(
        self, post_id: str, author_id: str, kind: str, text: str, media_ids: Sequence[str], now: datetime
    ) -> ContentScoreMessage | None:
        if kind == "story":
            target_type: ContentScoreTargetType = "post"
        else:
            target_type = "clip" if kind == "clip" else "post"
        await self.remember_post_media(post_id, author_id, target_type, media_ids, now)
        if not text.strip():
            return None
        response = await self.text_moderation.classify_content(
            ContentModerationRequest(
                content_id=post_id,
                content_type="clip_caption" if target_type == "clip" else "post",
                text=text[:MAXIMUM_SCORED_TEXT_LENGTH],
                author_id=author_id,
                now=now,
            )
        )
        model_version = response.metadata.model_version or "+".join(response.classifier_sources)
        message = ContentScoreMessage(
            score_id=build_score_id("text", post_id, model_version),
            target_type=target_type,
            target_id=post_id,
            owner_id=author_id,
            score=response.score,
            suggested_action=response.suggested_action,
            categories=[ContentScoreCategory(category=item.category, score=item.score) for item in response.categories],
            model_version=model_version,
            generated_at=now,
        )
        await self.publisher.publish_content_score(message)
        return message

    def build_image_url(self, image_key: str | None) -> str | None:
        if not self.media_bucket or not image_key:
            return None
        return f"s3://{self.media_bucket}/{image_key.lstrip('/')}"

    async def publish_sensitivity_advisory(self, message: ContentScoreMessage, media_id: str) -> bool:
        scores = map_categories_to_social_sensitive_labels(message.categories)
        if not scores or message.target_type not in ("post", "clip"):
            return False
        event = SensitivityAdvisedEvent(
            id=build_score_id("sensitivity", message.target_id, media_id, message.model_version),
            subject=message.target_id,
            occurred_at=message.generated_at,
            data=SensitivityAdvisedData(
                target_type="clip" if message.target_type == "clip" else "post",
                target_id=message.target_id,
                owner_id=message.owner_id,
                media_id=media_id,
                scores=scores,
                confidence=scores[0].score,
                model_version=message.model_version,
            ),
        )
        try:
            await self.sensitivity_publisher.publish_sensitivity_advisory(event)
        except Exception:
            scoring_logger.exception("sensitivity_advisory_publish_failed")
            return False
        return self.sensitivity_publisher.delivers

    async def score_processed_media(
        self, media_id: str, owner_id: str, purpose: str | None, now: datetime, image_key: str | None = None
    ) -> ContentScoreMessage | None:
        links = await self.backend.read_sorted_set_highest_members([self.keyspace.media_post_link_key(media_id)], 1)
        if not links or not links[0]:
            return None
        post_id, author_id, target_type = links[0][0][0].split(LINK_SEPARATOR)
        response = await asyncio.to_thread(
            self.image_moderation.classify_image,
            ImageModerationRequest(
                media_id=media_id, owner_id=owner_id, purpose=purpose, image_url=self.build_image_url(image_key)
            ),
            now,
        )
        if response.no_signal:
            if response.model_version == "unavailable":
                scoring_logger.error(
                    "image_moderation_unavailable_for_media",
                    extra={"media_id": media_id, "post_id": post_id},
                )
            return None
        message = ContentScoreMessage(
            score_id=build_score_id("image", post_id, media_id, response.model_version),
            target_type="clip" if target_type == "clip" else "post",
            target_id=post_id,
            owner_id=author_id,
            score=response.score,
            suggested_action=response.suggested_action,
            categories=response.categories,
            model_version=response.model_version,
            generated_at=now,
        )
        await self.publisher.publish_content_score(message)
        await self.publish_sensitivity_advisory(message, media_id)
        return message
