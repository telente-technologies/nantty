from collections.abc import Iterable

from src.modules.live_safety.dtos.live_safety_dto import (
    DetectedModerationLabel,
    LiveSafetyCategory,
    LiveSafetySuggestedAction,
)

SEVERE_LIVE_CATEGORIES = frozenset(
    {"child_safety", "sexual_explicit", "graphic_violence", "self_harm", "weapon_threat", "gore"}
)
HOLD_SUGGESTION_CONFIDENCE = 0.90
REVIEW_SUGGESTION_CONFIDENCE = 0.50

LABEL_CATEGORY_BY_NAME: dict[str, str] = {
    label.lower(): category
    for category, labels in {
        "sexual_explicit": (
            "Explicit",
            "Explicit Nudity",
            "Explicit Sexual Activity",
            "Sexual Activity",
            "Graphic Male Nudity",
            "Graphic Female Nudity",
            "Sex Toys",
            "Adult Toys",
            "Illustrated Explicit Nudity",
            "Exposed Male Genitalia",
            "Exposed Female Genitalia",
            "Exposed Buttocks or Anus",
            "Exposed Female Nipple",
        ),
        "sexual_suggestive": (
            "Non-Explicit Nudity of Intimate parts and Kissing",
            "Non-Explicit Nudity",
            "Obstructed Intimate Parts",
            "Suggestive",
            "Partial Nudity",
            "Revealing Clothes",
            "Swimwear or Underwear",
            "Kissing on the Lips",
            "Implied Nudity",
            "Female Swimwear Or Underwear",
            "Male Swimwear Or Underwear",
            "Bare Back",
        ),
        "graphic_violence": (
            "Graphic Violence",
            "Graphic Violence Or Gore",
            "Physical Violence",
            "Explosions and Blasts",
            "Violence",
        ),
        "weapon_threat": ("Weapon Violence",),
        "weapons": ("Weapons",),
        "self_harm": ("Self-Harm", "Self Injury", "Hanging"),
        "gore": (
            "Blood & Gore",
            "Corpses",
            "Emaciated Bodies",
            "Death and Emaciation",
            "Visually Disturbing",
            "Air Crash",
            "Crashes",
        ),
        "hate_symbols": ("Hate Symbols", "Nazi Party", "White Supremacy", "Extremist"),
        "drugs": (
            "Drugs & Tobacco",
            "Drugs",
            "Drug Products",
            "Drug Use",
            "Pills",
            "Drug Paraphernalia",
            "Tobacco",
            "Smoking",
            "Tobacco Products",
            "Alcohol",
            "Drinking",
            "Alcoholic Beverages",
        ),
        "rude_gestures": ("Rude Gestures", "Middle Finger"),
        "gambling": ("Gambling",),
    }.items()
    for label in labels
}


def most_specific_labels(labels: Iterable[DetectedModerationLabel]) -> list[DetectedModerationLabel]:
    collected = list(labels)
    parents = {label.parent_name.lower() for label in collected if label.parent_name}
    return [label for label in collected if label.name.lower() not in parents]


def category_for_label(label: DetectedModerationLabel) -> str:
    return LABEL_CATEGORY_BY_NAME.get(label.name.lower()) or LABEL_CATEGORY_BY_NAME.get(
        label.parent_name.lower(), "other"
    )


def map_labels_to_categories(labels: Iterable[DetectedModerationLabel]) -> list[LiveSafetyCategory]:
    best: dict[str, float] = {}
    for label in most_specific_labels(labels):
        category = category_for_label(label)
        best[category] = max(best.get(category, 0.0), label.confidence)
    return sorted(
        (
            LiveSafetyCategory(category=category, confidence=round(confidence, 6))
            for category, confidence in best.items()
        ),
        key=lambda item: (-item.confidence, item.category),
    )


def suggested_action_for_categories(categories: Iterable[LiveSafetyCategory]) -> LiveSafetySuggestedAction:
    action: LiveSafetySuggestedAction = "allow"
    for item in categories:
        if item.category in SEVERE_LIVE_CATEGORIES and item.confidence >= HOLD_SUGGESTION_CONFIDENCE:
            return "hold"
        if item.confidence >= REVIEW_SUGGESTION_CONFIDENCE:
            action = "review"
    return action
