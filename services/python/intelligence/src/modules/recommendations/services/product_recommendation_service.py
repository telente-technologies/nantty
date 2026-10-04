import math
from collections.abc import Mapping

from src.dtos.common_dto import RankingResponseMetadata
from src.models.viewer_online_features_model import ViewerOnlineFeatures
from src.modules.model_registry.models.model_bundle_model import ItemSimilarityBundle
from src.modules.model_registry.services.active_model_holder_service import ActiveModelHolder
from src.modules.recommendations.dtos.recommendation_dto import (
    ProductCandidate,
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


def score_product_candidates(
    request: ProductRecommendationRequest,
    online_features: ViewerOnlineFeatures,
    model_neighbours: Mapping[str, float],
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
    def __init__(self, feature_store: OnlineFeatureStore | None, model_holder: ActiveModelHolder) -> None:
        self.feature_store = feature_store
        self.model_holder = model_holder

    async def recommend_products(self, request: ProductRecommendationRequest) -> RecommendationResponse:
        now = resolve_request_time(request.now)
        loaded_bundle = self.model_holder.get_active_bundle("item_similarity")
        bundle = loaded_bundle if isinstance(loaded_bundle, ItemSimilarityBundle) else None
        anchor_id = request.anchor_product.product_id if request.anchor_product else None
        neighbours = read_model_neighbours(bundle, request.surface, anchor_id)
        online_features, degraded = await read_viewer_online_features_safely(
            self.feature_store,
            request.viewer.user_id,
            sorted({candidate.store_id for candidate in request.candidates}),
            sorted({topic for candidate in request.candidates for topic in candidate.topics}),
            [],
            now,
            False,
        )
        if request.candidates:
            scored = score_product_candidates(request, online_features, neighbours)
            ordered = rerank_candidates_for_diversity(scored, STORE_DIVERSITY_RULES, request.limit)
            items = [
                RecommendedItem(item_id=item.item_id, score=round(item.score, 8), reason=request.surface)
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
                degraded=degraded,
                generated_at=now,
            ),
        )
