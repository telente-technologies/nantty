from collections.abc import Iterable

from src.modules.content_scoring.dtos.content_score_dto import ContentScoreCategory
from src.modules.content_scoring.dtos.sensitivity_advisory_dto import SensitiveLabelScore, SocialSensitiveLabel

SUGGESTIVE_NUDITY_WEIGHT = 0.6
MINIMUM_ADVISED_SCORE = 0.3

SOCIAL_LABEL_WEIGHTS_BY_CATEGORY: dict[str, tuple[SocialSensitiveLabel, float]] = {
    "nudity": ("nudity", 1.0),
    "sexual": ("nudity", 1.0),
    "sexual_explicit": ("nudity", 1.0),
    "sexual_suggestive": ("nudity", SUGGESTIVE_NUDITY_WEIGHT),
    "graphic_violence": ("graphic_violence", 1.0),
    "gore": ("graphic_violence", 1.0),
    "violence": ("graphic_violence", 0.8),
    "weapon_threat": ("dangerous_acts", 1.0),
    "dangerous_acts": ("dangerous_acts", 1.0),
    "self_harm": ("self_harm", 1.0),
}


def map_categories_to_social_sensitive_labels(categories: Iterable[ContentScoreCategory]) -> list[SensitiveLabelScore]:
    best: dict[SocialSensitiveLabel, float] = {}
    for category in categories:
        mapping = SOCIAL_LABEL_WEIGHTS_BY_CATEGORY.get(category.category)
        if mapping is None:
            continue
        label, weight = mapping
        best[label] = max(best.get(label, 0.0), round(category.score * weight, 6))
    return sorted(
        (
            SensitiveLabelScore(label=label, score=score)
            for label, score in best.items()
            if score >= MINIMUM_ADVISED_SCORE
        ),
        key=lambda item: (-item.score, item.label),
    )
