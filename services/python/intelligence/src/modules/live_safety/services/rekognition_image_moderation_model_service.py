import logging
from typing import Any, Protocol
from urllib.parse import urlparse

from src.modules.content_scoring.dtos.content_score_dto import ImageModerationRequest
from src.modules.live_safety.dtos.live_safety_dto import DetectedModerationLabel
from src.modules.live_safety.services.live_safety_label_mapping_service import map_labels_to_categories

rekognition_logger = logging.getLogger("intelligence.live_safety.rekognition")
REKOGNITION_MODEL_VERSION_PREFIX = "aws-rekognition-moderation"


class RekognitionModerationClient(Protocol):
    def detect_moderation_labels(self, **kwargs: Any) -> dict[str, Any]: ...

    def detect_faces(self, **kwargs: Any) -> dict[str, Any]: ...


class FrameLabelDetector(Protocol):
    version: str

    def detect_frame_labels(self, bucket: str, key: str) -> list[DetectedModerationLabel]: ...


def parse_s3_image_url(image_url: str | None) -> tuple[str, str] | None:
    if not image_url:
        return None
    parsed = urlparse(image_url)
    if parsed.scheme != "s3" or not parsed.netloc or not parsed.path.strip("/"):
        return None
    return parsed.netloc, parsed.path.lstrip("/")


class ImageSourceNotAllowedError(ValueError):
    pass


class RekognitionImageModerationModel:
    def __init__(
        self,
        client: RekognitionModerationClient,
        minimum_confidence_percent: float = 50.0,
        allowed_image_buckets: frozenset[str] = frozenset(),
    ) -> None:
        self.client = client
        self.minimum_confidence_percent = minimum_confidence_percent
        self.allowed_image_buckets = allowed_image_buckets
        self.version = REKOGNITION_MODEL_VERSION_PREFIX

    def detect_frame_labels(self, bucket: str, key: str) -> list[DetectedModerationLabel]:
        return self.detect_labels_for_image({"S3Object": {"Bucket": bucket, "Name": key}})

    def detect_labels_from_bytes(self, data: bytes) -> list[DetectedModerationLabel]:
        return self.detect_labels_for_image({"Bytes": data})

    def detect_face_ages_in_frame(self, bucket: str, key: str) -> dict[str, Any]:
        return self.client.detect_faces(Image={"S3Object": {"Bucket": bucket, "Name": key}}, Attributes=["AGE_RANGE"])

    def detect_face_ages_from_bytes(self, data: bytes) -> dict[str, Any]:
        return self.client.detect_faces(Image={"Bytes": data}, Attributes=["AGE_RANGE"])

    def detect_labels_for_image(self, image: dict[str, Any]) -> list[DetectedModerationLabel]:
        response = self.client.detect_moderation_labels(Image=image, MinConfidence=self.minimum_confidence_percent)
        if model_version := response.get("ModerationModelVersion"):
            self.version = f"{REKOGNITION_MODEL_VERSION_PREFIX}-{model_version}"
        return [
            DetectedModerationLabel(
                name=str(label.get("Name", "")),
                parent_name=str(label.get("ParentName", "")),
                confidence=round(min(max(float(label.get("Confidence", 0.0)) / 100.0, 0.0), 1.0), 6),
            )
            for label in response.get("ModerationLabels", [])
            if label.get("Name")
        ]

    def classify_image(self, request: ImageModerationRequest) -> dict[str, float]:
        location = parse_s3_image_url(request.image_url)
        if location is None:
            return {}
        if self.allowed_image_buckets and location[0] not in self.allowed_image_buckets:
            raise ImageSourceNotAllowedError("image bucket is not an allowed moderation source")
        labels = self.detect_frame_labels(*location)
        return {item.category: item.confidence for item in map_labels_to_categories(labels)}


def aws_credentials_available(session: Any) -> bool:
    try:
        return session.get_credentials() is not None
    except Exception:
        rekognition_logger.warning("aws_credentials_lookup_failed")
        return False
