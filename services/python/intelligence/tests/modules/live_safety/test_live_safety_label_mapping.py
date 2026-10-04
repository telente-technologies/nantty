import json
from pathlib import Path
from typing import Any

from src.modules.live_safety.dtos.live_safety_dto import DetectedModerationLabel, LiveSafetyCategory
from src.modules.live_safety.services.live_safety_label_mapping_service import (
    map_labels_to_categories,
    most_specific_labels,
    suggested_action_for_categories,
)
from src.modules.live_safety.services.rekognition_image_moderation_model_service import RekognitionImageModerationModel

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict[str, Any]:
    loaded: dict[str, Any] = json.loads((FIXTURES / name).read_text())
    return loaded


class RecordedRekognitionClient:
    def __init__(self, fixture: str) -> None:
        self.response = load_fixture(fixture)
        self.calls: list[dict[str, Any]] = []

    def detect_moderation_labels(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        return self.response


def categories_for(fixture: str) -> list[LiveSafetyCategory]:
    model = RekognitionImageModerationModel(RecordedRekognitionClient(fixture))
    return map_labels_to_categories(model.detect_frame_labels("frames-bucket", "live-safety/frames/l1/frame_1.jpeg"))


def test_explicit_nudity_maps_to_a_severe_category_that_suggests_a_hold() -> None:
    categories = categories_for("rekognition_explicit_nudity_frame.json")
    assert categories[0] == LiveSafetyCategory(category="sexual_explicit", confidence=0.964)
    assert suggested_action_for_categories(categories) == "hold"


def test_a_weapon_that_is_not_used_to_threaten_is_not_severe() -> None:
    categories = categories_for("rekognition_weapon_on_table_frame.json")
    assert [item.category for item in categories] == ["weapons"]
    assert suggested_action_for_categories(categories) == "review"


def test_weapon_violence_uses_the_most_specific_labels() -> None:
    categories = categories_for("rekognition_weapon_violence_frame.json")
    assert categories == [
        LiveSafetyCategory(category="weapon_threat", confidence=0.929),
        LiveSafetyCategory(category="gore", confidence=0.61),
    ]
    assert suggested_action_for_categories(categories) == "hold"


def test_a_safe_frame_has_no_categories() -> None:
    categories = categories_for("rekognition_safe_frame.json")
    assert categories == []
    assert suggested_action_for_categories(categories) == "allow"


def test_parents_are_dropped_only_when_a_child_label_is_present() -> None:
    labels = [
        DetectedModerationLabel(name="Violence", confidence=0.7),
        DetectedModerationLabel(name="Hate Symbols", confidence=0.8),
        DetectedModerationLabel(name="Weapons", parent_name="Violence", confidence=0.7),
    ]
    assert [label.name for label in most_specific_labels(labels)] == ["Hate Symbols", "Weapons"]


def test_rekognition_is_called_with_the_frame_in_s3_and_the_minimum_confidence() -> None:
    client = RecordedRekognitionClient("rekognition_explicit_nudity_frame.json")
    model = RekognitionImageModerationModel(client, minimum_confidence_percent=60.0)
    model.detect_frame_labels("frames-bucket", "live-safety/frames/l1/frame_1.jpeg")
    assert client.calls == [
        {
            "Image": {"S3Object": {"Bucket": "frames-bucket", "Name": "live-safety/frames/l1/frame_1.jpeg"}},
            "MinConfidence": 60.0,
        }
    ]
    assert model.version == "aws-rekognition-moderation-7.0"
