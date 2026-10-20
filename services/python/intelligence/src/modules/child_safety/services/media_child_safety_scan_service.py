import base64
import binascii
import hashlib
import logging
from datetime import UTC, datetime
from typing import Any

from src.modules.child_safety.dtos.child_safety_dto import (
    ChildSafetyVerdict,
    HashCheckOutcome,
    HashMatch,
    MediaScanRequest,
    MediaScanResponse,
)
from src.modules.child_safety.services.child_safety_signal_service import (
    DEFAULT_EXPLICIT_CONFIDENCE,
    DEFAULT_MINOR_AGE_CEILING,
    has_high_confidence_explicit_label,
    is_suspected_child_safety,
)
from src.modules.child_safety.services.hash_match_provider_interface_service import (
    HashMatchProvider,
    HashMatchUnavailableError,
)
from src.modules.content_scoring.dtos.content_score_dto import ContentScoreCategory
from src.modules.content_scoring.services.image_moderation_interface_service import (
    ImageModerationModelHolder,
    suggested_action_for_score,
)
from src.modules.live_safety.dtos.live_safety_dto import DetectedModerationLabel
from src.modules.live_safety.services.live_safety_label_mapping_service import map_labels_to_categories

child_safety_logger = logging.getLogger("intelligence.child_safety")
CHILD_SAFETY_CATEGORY = "child_safety"


class MediaScanRejectedError(ValueError):
    pass


def decode_scan_frames(request: MediaScanRequest) -> list[bytes]:
    try:
        return [base64.b64decode(frame.data_base64, validate=True) for frame in request.frames]
    except (binascii.Error, ValueError) as error:
        raise MediaScanRejectedError("frames must be base64 encoded images") from error


class MediaChildSafetyScanService:
    def __init__(
        self,
        image_models: ImageModerationModelHolder,
        hash_provider: HashMatchProvider,
        explicit_confidence: float = DEFAULT_EXPLICIT_CONFIDENCE,
        minor_age_ceiling: int = DEFAULT_MINOR_AGE_CEILING,
    ) -> None:
        self.image_models = image_models
        self.hash_provider = hash_provider
        self.explicit_confidence = explicit_confidence
        self.minor_age_ceiling = minor_age_ceiling

    def scan_media(self, request: MediaScanRequest, now: datetime | None = None) -> MediaScanResponse:
        generated_at = now or datetime.now(UTC)
        frames = decode_scan_frames(request)
        hash_check, match = self.check_known_hashes(request.original_sha256, frames)
        if match is not None:
            child_safety_logger.warning("media_scan_blocked", extra={"signal": "hash_match"})
            return self.blocked_response(request, generated_at, "hash_match", hash_check, match)
        labels, suspected, model_version = self.detect_labels_and_minor_faces(frames)
        if suspected:
            child_safety_logger.warning("media_scan_blocked", extra={"signal": "suspected_minor_explicit"})
            return self.blocked_response(
                request, generated_at, "suspected_minor_explicit", hash_check, None, model_version
            )
        categories = [
            ContentScoreCategory(category=item.category, score=item.confidence)
            for item in map_labels_to_categories(labels or [])
        ]
        top = categories[0] if categories else None
        score = top.score if top else 0.0
        suggested = suggested_action_for_score(score)
        if hash_check == "unavailable" or labels is None:
            suggested = "block" if suggested == "block" else "review"
        return MediaScanResponse(
            media_id=request.media_id,
            score=score,
            top_category=top.category if top else None,
            categories=categories,
            suggested_action=suggested,
            no_signal=not categories,
            child_safety=ChildSafetyVerdict(blocked=False, signal="none", hash_check=hash_check),
            model_version=model_version,
            generated_at=generated_at,
        )

    def check_known_hashes(
        self, original_sha256: str | None, frames: list[bytes]
    ) -> tuple[HashCheckOutcome, HashMatch | None]:
        if not self.hash_provider.enabled:
            return "disabled", None
        try:
            match = self.hash_provider.match_known_digest(original_sha256) if original_sha256 else None
            for frame in frames:
                if match is not None:
                    break
                match = self.hash_provider.match_image(frame) or self.hash_provider.match_known_digest(
                    hashlib.sha256(frame).hexdigest()
                )
        except HashMatchUnavailableError:
            child_safety_logger.error("media_scan_hash_check_unavailable")
            return "unavailable", None
        return ("matched", match) if match is not None else ("clear", None)

    def detect_labels_and_minor_faces(
        self, frames: list[bytes]
    ) -> tuple[list[DetectedModerationLabel] | None, bool, str]:
        model: Any = self.image_models.active_model
        detect_labels = getattr(model, "detect_labels_from_bytes", None)
        detect_faces = getattr(model, "detect_face_ages_from_bytes", None)
        if not callable(detect_labels) or not frames:
            return [], False, model.version
        labels: list[DetectedModerationLabel] = []
        try:
            for frame in frames:
                frame_labels = detect_labels(frame)
                labels.extend(frame_labels)
                if callable(detect_faces) and has_high_confidence_explicit_label(
                    frame_labels, self.explicit_confidence
                ):
                    faces = detect_faces(frame)
                    if is_suspected_child_safety(
                        frame_labels, faces, self.explicit_confidence, self.minor_age_ceiling
                    ):
                        return frame_labels, True, model.version
        except Exception:
            child_safety_logger.error("media_scan_label_detection_failed")
            return None, False, "unavailable"
        return labels, False, model.version

    def blocked_response(
        self,
        request: MediaScanRequest,
        generated_at: datetime,
        signal: str,
        hash_check: HashCheckOutcome,
        match: HashMatch | None,
        model_version: str = "",
    ) -> MediaScanResponse:
        return MediaScanResponse(
            media_id=request.media_id,
            score=1.0,
            top_category=CHILD_SAFETY_CATEGORY,
            categories=[ContentScoreCategory(category=CHILD_SAFETY_CATEGORY, score=1.0)],
            suggested_action="block",
            no_signal=False,
            child_safety=ChildSafetyVerdict(
                blocked=True,
                signal="hash_match" if signal == "hash_match" else "suspected_minor_explicit",
                hash_check=hash_check,
                provider=match.provider if match else "",
                match_reference=match.reference if match else "",
            ),
            model_version=model_version or f"hash-match-{self.hash_provider.name}",
            generated_at=generated_at,
        )
