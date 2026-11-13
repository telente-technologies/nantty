import hashlib
import math
from collections.abc import Mapping

from src.dtos.common_dto import RankingResponseMetadata
from src.models.viewer_online_features_model import ViewerOnlineFeatures
from src.modules.model_registry.models.model_bundle_model import ItemSimilarityBundle
from src.modules.model_registry.services.active_model_holder_service import ActiveModelHolder
from src.modules.recommendations.dtos.recommendation_dto import (
    ProductCandidate,
    ProductCandidateRecallRequest,
    ProductRecommendationRequest,
    RecommendationResponse,
    RecommendedItem,
)
from src.repositories.online_feature_repository import OnlineFeatureStore
from src.services.diversity_reranking_service import DiversityCandidate, DiversityRules, rerank_candidates_for_diversity
from src.services.ranking_context_service import (
    read_viewer_online_features_safely,
    resolve_request_identifier,
    resolve_request_time,
)
from src.utils.affinity_feature_util import read_normalized_affinity, summarize_topic_affinities

SURFACE_WEIGHTS: dict[str, tuple[float, float, float, float]] = {
    "similar": (0.6, 0.25, 0.0, 0.15),
    "bought_together": (0.75, 0.1, 0.0, 0.15),
    "featured_with": (0.3, 0.0, 0.5, 0.2),
    "mart_home": (0.0, 0.0, 0.6, 0.4),
    "for_you": (0.0, 0.0, 0.45, 0.15),
    "clips": (0.0, 0.0, 0.45, 0.15),
}
STORE_DIVERSITY_RULES = DiversityRules(
    max_consecutive_same_author=2,
    max_consecutive_product_posts=1000,
    maximum_product_post_share=1.0,
    topic_repeat_penalty=0.95,
    topic_window_size=2,
)


def calculate_product_attribute_similarity(anchor: ProductCandidate, candidate: ProductCandidate) -> float:
    same_category = 1.0 if anchor.category_id is not None and anchor.category_id == candidate.category_id else 0.0
    anchor_topics, candidate_topics = set(anchor.topics), set(candidate.topics)
    topic_union = anchor_topics | candidate_topics
    topic_jaccard = len(anchor_topics & candidate_topics) / len(topic_union) if topic_union else 0.0
    price_closeness = 0.0
    if (
        anchor.price
        and candidate.price
        and anchor.price.currency == candidate.price.currency
        and anchor.price.amount_minor > 0
        and candidate.price.amount_minor > 0
    ):
        price_ratio = math.log(candidate.price.amount_minor / anchor.price.amount_minor)
        price_closeness = 1.0 - min(abs(price_ratio), 1.0)
    return 0.5 * same_category + 0.3 * topic_jaccard + 0.2 * price_closeness


def calculate_product_personal_affinity(
    candidate: ProductCandidate,
    online_features: ViewerOnlineFeatures,
    chosen_topics: frozenset[str],
    country: str | None,
) -> float:
    store_affinity = max(read_normalized_affinity(online_features.account_affinity_by_account, candidate.store_id), 0)
    topic_affinity_max, _mean = summarize_topic_affinities(online_features.topic_affinity_by_topic, candidate.topics)
    chosen_match = 1.0 if any(topic in chosen_topics for topic in candidate.topics) else 0.0
    same_country = 1.0 if country is not None and candidate.country == country else 0.0
    return 0.35 * store_affinity + 0.3 * max(topic_affinity_max, 0.0) + 0.2 * chosen_match + 0.15 * same_country


def calculate_product_popularity(candidate: ProductCandidate, maximum_log_popularity: float) -> float:
    rating_bonus = (candidate.rating or 3.5) / 5.0
    raw_popularity = math.log1p(candidate.sales_count * 5 + candidate.view_count)
    return 0.8 * raw_popularity / maximum_log_popularity + 0.2 * rating_bonus


def calculate_product_exploration_tiebreaker(
    request: ProductRecommendationRequest,
    product_id: str,
    maximum_offset: float,
    rotation_hours: int,
) -> float:
    """Return a reproducible, bounded tie-breaker; it is not a random eligibility signal."""
    bounded_offset = min(max(maximum_offset, 0.0), 0.05)
    bounded_rotation_hours = min(max(rotation_hours, 1), 168)
    window = int(resolve_request_time(request.now).timestamp() // (bounded_rotation_hours * 3600))
    seed = f"{request.viewer.user_id}:{request.surface}:{window}:{product_id}".encode()
    value = int.from_bytes(hashlib.sha256(seed).digest()[:4], "big") / 0xFFFFFFFF
    return (value - 0.5) * 2.0 * bounded_offset


def calculate_product_item_affinity(candidate: ProductCandidate, online_features: ViewerOnlineFeatures) -> float:
    return max(read_normalized_affinity(online_features.item_affinity_by_item, candidate.product_id), 0.0)


def score_product_candidates(
    request: ProductRecommendationRequest,
    online_features: ViewerOnlineFeatures,
    model_neighbours: Mapping[str, float],
    verified_store_bonus: float,
    exploration_max_offset: float,
    exploration_rotation_hours: int,
) -> list[DiversityCandidate]:
    model_weight, attribute_weight, personal_weight, popularity_weight = SURFACE_WEIGHTS[request.surface]
    excluded = frozenset(request.excluded_product_ids) | frozenset(request.viewer.hidden_item_ids)
    blocked_stores = frozenset(request.viewer.blocked_account_ids) | frozenset(request.viewer.muted_account_ids)
    maximum_log_popularity = max(
        [math.log1p(candidate.sales_count * 5 + candidate.view_count) for candidate in request.candidates] + [1.0]
    )
    chosen_topics = frozenset(request.viewer.chosen_topics)
    scored: dict[str, DiversityCandidate] = {}
    for candidate in request.candidates:
        anchor_id = request.anchor_product.product_id if request.anchor_product else None
        if (
            candidate.product_id in excluded
            or candidate.product_id == anchor_id
            or candidate.store_id in blocked_stores
            or not candidate.in_stock
            or candidate.product_id in scored
        ):
            continue
        attribute_similarity = (
            calculate_product_attribute_similarity(request.anchor_product, candidate) if request.anchor_product else 0.0
        )
        score = (
            model_weight * model_neighbours.get(candidate.product_id, 0.0)
            + attribute_weight * attribute_similarity
            + personal_weight
            * calculate_product_personal_affinity(candidate, online_features, chosen_topics, request.viewer.country)
            + popularity_weight * calculate_product_popularity(candidate, maximum_log_popularity)
        )
        if request.surface in {"for_you", "mart_home", "clips"}:
            score += 0.4 * calculate_product_item_affinity(candidate, online_features)
            # Keep verified merchants discoverable first while still ranking
            # by viewer fit within each trust tier. Eligible non-verified stores
            # remain available after verified candidates.
            score += verified_store_bonus if candidate.store_verified else 0.0
            # Bounded daily exploration prevents a static catalogue shortlist
            # on both discovery surfaces. Verified-store ordering is applied
            # as a trust tier below, so exploration only reorders within tiers.
            score += calculate_product_exploration_tiebreaker(
                request, candidate.product_id, exploration_max_offset, exploration_rotation_hours
            )
        scored[candidate.product_id] = DiversityCandidate(
            candidate.product_id, score, candidate.store_id, None, False, frozenset(candidate.topics)
        )
    return list(scored.values())


def read_model_neighbours(
    bundle: ItemSimilarityBundle | None, surface: str, anchor_product_id: str | None
) -> dict[str, float]:
    if bundle is None or anchor_product_id is None:
        return {}
    source = bundle.bought_together_items if surface == "bought_together" else bundle.similar_items
    return dict(source.get(anchor_product_id, []))


class ProductRecommendationService:
    def __init__(
        self,
        feature_store: OnlineFeatureStore | None,
        model_holder: ActiveModelHolder,
        verified_store_bonus: float,
        exploration_max_offset: float,
        exploration_rotation_hours: int,
    ) -> None:
        self.feature_store = feature_store
        self.model_holder = model_holder
        self.verified_store_bonus = verified_store_bonus
        self.exploration_max_offset = exploration_max_offset
        self.exploration_rotation_hours = exploration_rotation_hours

    async def recall_product_candidates(self, request: ProductCandidateRecallRequest) -> list[str]:
        if not request.personalization_allowed or self.feature_store is None:
            return []
        rows = await self.feature_store.read_viewer_top_item_affinities(
            request.viewer.user_id, request.limit, resolve_request_time(request.now)
        )
        return [item_id for item_id, score in rows if score > 0.0]

    async def recommend_products(self, request: ProductRecommendationRequest) -> RecommendationResponse:
        now = resolve_request_time(request.now)
        loaded_bundle = self.model_holder.get_active_bundle("item_similarity")
        bundle = loaded_bundle if isinstance(loaded_bundle, ItemSimilarityBundle) else None
        anchor_id = request.anchor_product.product_id if request.anchor_product else None
        neighbours = read_model_neighbours(bundle, request.surface, anchor_id)
        if request.personalization_allowed:
            online_features, degraded = await read_viewer_online_features_safely(
                self.feature_store,
                request.viewer.user_id,
                sorted({candidate.store_id for candidate in request.candidates}),
                sorted({topic for candidate in request.candidates for topic in candidate.topics}),
                sorted({candidate.product_id for candidate in request.candidates}),
                now,
                False,
            )
        else:
            online_features, degraded = ViewerOnlineFeatures(), False
        if request.candidates:
            scored = score_product_candidates(
                request,
                online_features,
                neighbours,
                self.verified_store_bonus,
                self.exploration_max_offset,
                self.exploration_rotation_hours,
            )
            # Rank the complete bounded candidate pool before applying the
            # response limit. Otherwise an unverified product can occupy the
            # initial top-N and hide verified stores before the trust tier is
            # applied below.
            ordered = rerank_candidates_for_diversity(scored, STORE_DIVERSITY_RULES, len(scored))
            verified_by_id = {candidate.product_id: candidate.store_verified for candidate in request.candidates}
            if request.surface in {"for_you", "mart_home", "clips"}:
                ordered = [item for item in ordered if verified_by_id.get(item.item_id, False)] + [
                    item for item in ordered if not verified_by_id.get(item.item_id, False)
                ]
            ordered = ordered[: request.limit]
            items = [
                RecommendedItem(
                    item_id=item.item_id,
                    score=round(item.score, 8),
                    reason=(
                        "verified_store"
                        if verified_by_id.get(item.item_id) and self.verified_store_bonus > 0
                        else "personalized"
                    )
                    if request.surface in {"for_you", "clips"}
                    else request.surface,
                )
                for item in ordered
            ]
            source = "model" if neighbours else "rules"
        else:
            excluded = frozenset(request.excluded_product_ids) | {anchor_id or ""}
            fallback_rows = list(neighbours.items()) or (bundle.popular_items if bundle else [])
            reason = request.surface if neighbours else "popular"
            items = [
                RecommendedItem(item_id=item_id, score=round(score, 8), reason=reason)
                for item_id, score in fallback_rows
                if item_id not in excluded
            ][: request.limit]
            source = "model" if neighbours else "popularity"
        return RecommendationResponse(
            items=items,
            metadata=RankingResponseMetadata(
                request_id=resolve_request_identifier(request.request_id),
                ranking_source=f"products:{request.surface}:{source}",
                model_version=self.model_holder.get_active_version("item_similarity"),
                degraded=degraded or bundle is None,
                generated_at=now,
            ),
        )
