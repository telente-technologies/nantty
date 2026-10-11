import re
from datetime import datetime

from src.modules.live_safety.dtos.live_safety_dto import LiveSafetyCategory
from src.modules.moderation.dtos.content_moderation_dto import ContentModerationRequest
from src.modules.moderation.services.content_moderation_service import ContentModerationService

MAXIMUM_SCORED_TRANSCRIPT_LENGTH = 5000
SELF_HARM_SPEECH_CONFIDENCE = 0.75
TRANSCRIPT_CATEGORY_BY_TEXT_CATEGORY = {
    "violence": "violent_speech",
    "harassment": "harassment",
    "scam": "scam",
    "spam": "spam",
    "prohibited_goods": "prohibited_goods",
    "personal_data": "personal_data",
    "self_harm": "self_harm",
    "hate": "hate_speech",
}
SELF_HARM_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\b(kill|hurt|harm|cut)\s+my\s*self\b",
        r"\bend\s+(it\s+all|my\s+life)\b",
        r"\b(want|going)\s+to\s+die\b",
        r"\bsuicid(e|al)\b",
    )
)


def detect_self_harm_speech(text: str) -> bool:
    return any(pattern.search(text) for pattern in SELF_HARM_PATTERNS)


class TranscriptModerationScorer:
    version = "transcript-heuristics-v1"

    def __init__(self, text_moderation: ContentModerationService) -> None:
        self.text_moderation = text_moderation

    async def score_transcript(self, segment_id: str, text: str, now: datetime) -> list[LiveSafetyCategory]:
        trimmed = text.strip()[:MAXIMUM_SCORED_TRANSCRIPT_LENGTH]
        if not trimmed:
            return []
        response = await self.text_moderation.classify_content(
            ContentModerationRequest(content_id=segment_id, content_type="comment", text=trimmed, now=now)
        )
        best: dict[str, float] = {}
        for item in response.categories:
            category = TRANSCRIPT_CATEGORY_BY_TEXT_CATEGORY.get(item.category, "other")
            best[category] = max(best.get(category, 0.0), item.score)
        if detect_self_harm_speech(trimmed):
            best["self_harm"] = max(best.get("self_harm", 0.0), SELF_HARM_SPEECH_CONFIDENCE)
        return sorted(
            (
                LiveSafetyCategory(category=name, confidence=round(min(score, 1.0), 6))
                for name, score in best.items()
                if score > 0
            ),
            key=lambda item: (-item.confidence, item.category),
        )
