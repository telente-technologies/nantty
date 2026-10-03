from src.dtos.common_dto import RankingResponseMetadata
from src.modules.moderation.dtos.content_moderation_dto import (
    CategoryScore,
    ContentModerationRequest,
    ContentModerationResponse,
    ModerationCategory,
)
from src.modules.moderation.services.moderation_model_interface_service import ModerationModelHolder
from src.modules.moderation.services.moderation_text_heuristics_service import evaluate_text_heuristics
from src.services.ranking_context_service import resolve_request_identifier, resolve_request_time

BLOCK_SCORE_THRESHOLD = 0.85
REVIEW_SCORE_THRESHOLD = 0.5


class ContentModerationService:
    def __init__(self, model_holder: ModerationModelHolder) -> None:
        self.model_holder = model_holder

    async def classify_content(self, request: ContentModerationRequest) -> ContentModerationResponse:
        scores: dict[ModerationCategory, float] = {}
        signals: dict[ModerationCategory, list[str]] = {}
        for category, (score, matched_codes) in evaluate_text_heuristics(request.text).items():
            scores[category] = score
            signals[category] = matched_codes
        sources = ["heuristic"]
        degraded = False
        model = self.model_holder.active_model
        if model is not None:
            try:
                for category, model_score in model.classify(request.text, request.content_type).items():
                    scores[category] = max(scores.get(category, 0.0), min(max(model_score, 0.0), 1.0))
                    signals.setdefault(category, []).append(f"model:{model.version}")
                sources.append(f"model:{model.version}")
            except Exception:
                degraded = True
        categories = sorted(
            (
                CategoryScore(category=category, score=round(score, 6), signals=signals.get(category, []))
                for category, score in scores.items()
                if score > 0
            ),
            key=lambda item: (-item.score, item.category),
        )
        top = categories[0] if categories else None
        top_score = top.score if top else 0.0
        action = (
            "block"
            if top_score >= BLOCK_SCORE_THRESHOLD
            else "review"
            if top_score >= REVIEW_SCORE_THRESHOLD
            else "allow"
        )
        return ContentModerationResponse(
            content_id=request.content_id,
            categories=categories,
            top_category=top.category if top else None,
            score=top_score,
            suggested_action=action,
            classifier_sources=sources,
            metadata=RankingResponseMetadata(
                request_id=resolve_request_identifier(request.request_id),
                ranking_source="moderation:" + "+".join(sources),
                model_version=model.version if model and not degraded else None,
                degraded=degraded,
                generated_at=resolve_request_time(request.now),
            ),
        )
