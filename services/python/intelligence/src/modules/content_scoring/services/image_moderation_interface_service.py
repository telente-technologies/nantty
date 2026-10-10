import logging
from datetime import UTC, datetime
from typing import Protocol

from src.modules.content_scoring.dtos.content_score_dto import (
    ContentScoreCategory,
    ImageModerationRequest,
    ImageModerationResponse,
    SuggestedContentAction,
)

PLACEHOLDER_IMAGE_MODEL_VERSION = "image-no-signal-placeholder-v1"
IMAGE_BLOCK_SCORE_THRESHOLD = 0.85
IMAGE_REVIEW_SCORE_THRESHOLD = 0.5


class ImageModerationModel(Protocol):
    version: str

    def classify_image(self, request: ImageModerationRequest) -> dict[str, float]: ...


class NoSignalImageModerationModel:
    version = PLACEHOLDER_IMAGE_MODEL_VERSION

    def classify_image(self, _request: ImageModerationRequest) -> dict[str, float]:
        return {}


class ImageModerationModelHolder:
    def __init__(self) -> None:
        self._model: ImageModerationModel = NoSignalImageModerationModel()

    def register_model(self, model: ImageModerationModel) -> None:
        self._model = model

    def clear_model(self) -> None:
        self._model = NoSignalImageModerationModel()

    @property
    def active_model(self) -> ImageModerationModel:
        return self._model


def suggested_action_for_score(score: float) -> SuggestedContentAction:
    if score >= IMAGE_BLOCK_SCORE_THRESHOLD:
        return "block"
    if score >= IMAGE_REVIEW_SCORE_THRESHOLD:
        return "review"
    return "allow"


class ImageModerationService:
    def __init__(self, model_holder: ImageModerationModelHolder) -> None:
        self.model_holder = model_holder

    def classify_image(self, request: ImageModerationRequest, now: datetime | None = None) -> ImageModerationResponse:
        model = self.model_holder.active_model
        try:
            raw_scores = model.classify_image(request)
        except Exception:
            logging.getLogger("intelligence.content_scoring").exception(
                "image_moderation_failed", extra={"media_id": request.media_id}
            )
            return ImageModerationResponse(
                media_id=request.media_id,
                categories=[],
                score=0.0,
                suggested_action="review",
                no_signal=True,
                model_version="unavailable",
                generated_at=now or datetime.now(UTC),
            )
        categories = sorted(
            (
                ContentScoreCategory(category=category, score=round(min(max(score, 0.0), 1.0), 6))
                for category, score in raw_scores.items()
                if score > 0
            ),
            key=lambda item: (-item.score, item.category),
        )
        top_score = categories[0].score if categories else 0.0
        return ImageModerationResponse(
            media_id=request.media_id,
            categories=categories,
            score=top_score,
            suggested_action=suggested_action_for_score(top_score),
            no_signal=not categories,
            model_version=model.version,
            generated_at=now or datetime.now(UTC),
        )
