from collections.abc import Iterable, Mapping
from typing import Any

from src.modules.live_safety.dtos.live_safety_dto import DetectedModerationLabel

EXPLICIT_SEXUAL_LABEL_NAMES = frozenset(
    name.lower()
    for name in (
        "Explicit",
        "Explicit Nudity",
        "Explicit Sexual Activity",
        "Sexual Activity",
        "Exposed Male Genitalia",
        "Exposed Female Genitalia",
        "Exposed Buttocks or Anus",
        "Exposed Female Nipple",
        "Graphic Male Nudity",
        "Graphic Female Nudity",
    )
)
DEFAULT_EXPLICIT_CONFIDENCE = 0.90
DEFAULT_MINOR_AGE_CEILING = 18
MINIMUM_FACE_CONFIDENCE_PERCENT = 80.0


def highest_explicit_sexual_confidence(labels: Iterable[DetectedModerationLabel]) -> float:
    return max(
        (
            label.confidence
            for label in labels
            if label.name.lower() in EXPLICIT_SEXUAL_LABEL_NAMES or label.parent_name.lower() in EXPLICIT_SEXUAL_LABEL_NAMES
        ),
        default=0.0,
    )


def has_high_confidence_explicit_label(labels: Iterable[DetectedModerationLabel], threshold: float) -> bool:
    return highest_explicit_sexual_confidence(labels) >= threshold


def detected_faces_include_likely_minor(detect_faces_response: Mapping[str, Any], minor_age_ceiling: int) -> bool:
    for face in detect_faces_response.get("FaceDetails", []) or []:
        age_range = face.get("AgeRange") or {}
        high = age_range.get("High")
        if not isinstance(high, int | float) or float(face.get("Confidence", 0.0)) < MINIMUM_FACE_CONFIDENCE_PERCENT:
            continue
        if high < minor_age_ceiling:
            return True
    return False


def is_suspected_child_safety(
    labels: Iterable[DetectedModerationLabel],
    detect_faces_response: Mapping[str, Any] | None,
    explicit_threshold: float = DEFAULT_EXPLICIT_CONFIDENCE,
    minor_age_ceiling: int = DEFAULT_MINOR_AGE_CEILING,
) -> bool:
    if detect_faces_response is None or not has_high_confidence_explicit_label(labels, explicit_threshold):
        return False
    return detected_faces_include_likely_minor(detect_faces_response, minor_age_ceiling)
