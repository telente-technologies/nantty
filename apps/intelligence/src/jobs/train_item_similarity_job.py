import json
import math
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

import numpy as np
import polars as pl
from scipy import sparse

from src.integrations.dataset_storage_integration import DatasetStorageLocation
from src.modules.model_registry.models.model_bundle_model import ItemSimilarityBundle
from src.modules.model_registry.repositories.model_registry_repository import ModelRegistry
from src.modules.model_registry.services.model_promotion_service import register_and_maybe_activate_model
from src.utils.dataset_loading_util import extract_payload_text, load_raw_events
from src.utils.implicit_matrix_factorization_util import (
    calculate_item_cooccurrence_cosine,
    calculate_row_cosine_similarity,
    train_implicit_alternating_least_squares,
)
from src.utils.offline_metrics_util import calculate_catalog_coverage, calculate_intra_list_diversity

INTERACTION_WEIGHTS = {"product_viewed": 1.0, "added_to_cart": 3.0, "purchased": 5.0}
NEIGHBOUR_COUNT = 20
COOCCURRENCE_BLEND_WEIGHT = 0.7
POPULARITY_HALF_LIFE_DAYS = 7.0
TOPIC_EVENT_TYPES = ["post_viewed", "post_liked", "commented", "shared", "clip_watched", "product_viewed"]


def load_product_interactions(location: DatasetStorageLocation) -> pl.DataFrame:
    events = load_raw_events(location, list(INTERACTION_WEIGHTS))
    single_product = events.filter(pl.col("event_type") != "purchased").select(
        "actor_id",
        "occurred_at",
        "event_type",
        extract_payload_text("$.productId").alias("product_id"),
        extract_payload_text("$.storeId").alias("store_id"),
        pl.lit(None, dtype=pl.String).alias("order_id"),
    )
    purchases = events.filter(pl.col("event_type") == "purchased").with_columns(
        pl.col("payload_json")
        .str.json_decode(
            pl.Struct(
                {"orderId": pl.String, "storeId": pl.String, "items": pl.List(pl.Struct({"productId": pl.String}))}
            )
        )
        .alias("decoded")
    )
    purchased_items = (
        purchases.select(
            "actor_id",
            "occurred_at",
            "event_type",
            pl.col("decoded").struct.field("items").alias("items"),
            pl.col("decoded").struct.field("storeId").alias("store_id"),
            pl.col("decoded").struct.field("orderId").alias("order_id"),
        )
        .explode("items", empty_as_null=True)
        .select(
            "actor_id",
            "occurred_at",
            "event_type",
            pl.col("items").struct.field("productId").alias("product_id"),
            "store_id",
            "order_id",
        )
    )
    return pl.concat([single_product, purchased_items]).filter(pl.col("product_id").is_not_null())


def build_top_neighbours(
    similarity_row: np.ndarray, item_ids: list[str], item_index: int, limit: int
) -> list[tuple[str, float]]:
    candidate_indices = np.argsort(-similarity_row, kind="stable")
    neighbours = []
    for candidate_index in candidate_indices:
        if candidate_index == item_index or similarity_row[candidate_index] <= 0:
            continue
        neighbours.append((item_ids[int(candidate_index)], round(float(similarity_row[candidate_index]), 6)))
        if len(neighbours) >= limit:
            break
    return neighbours


def build_bought_together_lists(interactions: pl.DataFrame) -> dict[str, list[tuple[str, float]]]:
    baskets = (
        interactions.filter(pl.col("order_id").is_not_null()).group_by("order_id").agg(pl.col("product_id").unique())
    )
    pair_counts: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for products in baskets.get_column("product_id").to_list():
        for first in products:
            for second in products:
                if first != second:
                    pair_counts[first][second] += 1.0
    return {
        product: sorted(partners.items(), key=lambda pair: (-pair[1], pair[0]))[:10]
        for product, partners in pair_counts.items()
    }


def build_store_customer_topic_centroids(
    location: DatasetStorageLocation, interactions: pl.DataFrame
) -> dict[str, dict[str, float]]:
    purchasers = interactions.filter(pl.col("event_type") == "purchased").select("store_id", "actor_id").unique()
    topic_events = load_raw_events(location, TOPIC_EVENT_TYPES).select(
        "actor_id", pl.col("payload_json").str.json_path_match("$.topics").alias("topics_json")
    )
    topic_weights: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for actor_id, topics_json in topic_events.iter_rows():
        for topic in json.loads(topics_json or "[]"):
            topic_weights[actor_id][topic] += 1.0
    centroids: dict[str, dict[str, float]] = {}
    for store_id, group in purchasers.group_by("store_id"):
        centroid: dict[str, float] = defaultdict(float)
        for actor_id in group.get_column("actor_id").to_list():
            actor_topics = topic_weights.get(actor_id, {})
            total = sum(actor_topics.values()) or 1.0
            for topic, weight in actor_topics.items():
                centroid[topic] += weight / total
        norm = math.sqrt(sum(value * value for value in centroid.values())) or 1.0
        top_topics = sorted(centroid.items(), key=lambda pair: -pair[1])[:30]
        centroids[str(store_id[0])] = {topic: round(value / norm, 6) for topic, value in top_topics}
    return centroids


def evaluate_leave_last_out_recall(
    interactions: pl.DataFrame, similar_items: dict[str, list[tuple[str, float]]]
) -> float | None:
    hits, trials = 0, 0
    for _actor, history in interactions.sort("occurred_at").group_by("actor_id", maintain_order=True):
        products = list(dict.fromkeys(history.get_column("product_id").to_list()))
        if len(products) < 2:
            continue
        held_out, context = products[-1], products[:-1]
        scores: dict[str, float] = defaultdict(float)
        for product in context:
            for neighbour, similarity in similar_items.get(product, []):
                if neighbour not in context:
                    scores[neighbour] += similarity
        top_ten = [item for item, _score in sorted(scores.items(), key=lambda pair: -pair[1])[:10]]
        hits += int(held_out in top_ten)
        trials += 1
    return hits / trials if trials else None


def train_item_similarity_model(
    location: DatasetStorageLocation, registry: ModelRegistry, force_activation: bool
) -> dict[str, Any]:
    interactions = load_product_interactions(location)
    if interactions.height < 20:
        return {"modelName": "item_similarity", "skipped": "not_enough_rows", "rows": interactions.height}
    now = datetime.now(UTC)
    weighted = interactions.with_columns(
        pl.col("event_type").replace_strict(INTERACTION_WEIGHTS, return_dtype=pl.Float64).alias("weight"),
        ((pl.lit(now) - pl.col("occurred_at")).dt.total_seconds() / 86_400).alias("age_days"),
    )
    user_ids = sorted(weighted.get_column("actor_id").unique().to_list())
    item_ids = sorted(weighted.get_column("product_id").unique().to_list())
    user_index = {user_id: index for index, user_id in enumerate(user_ids)}
    item_index = {item_id: index for index, item_id in enumerate(item_ids)}
    aggregated = weighted.group_by("actor_id", "product_id").agg(pl.col("weight").sum())
    interaction_matrix = sparse.csr_matrix(
        (
            aggregated.get_column("weight").to_numpy(),
            (
                [user_index[user] for user in aggregated.get_column("actor_id").to_list()],
                [item_index[item] for item in aggregated.get_column("product_id").to_list()],
            ),
        ),
        shape=(len(user_ids), len(item_ids)),
    )
    binary = interaction_matrix.copy()
    binary.data = np.ones_like(binary.data)
    cooccurrence = calculate_item_cooccurrence_cosine(binary).toarray()
    _user_factors, item_factors = train_implicit_alternating_least_squares(interaction_matrix)
    blended = COOCCURRENCE_BLEND_WEIGHT * cooccurrence + (1 - COOCCURRENCE_BLEND_WEIGHT) * np.clip(
        calculate_row_cosine_similarity(item_factors), 0, 1
    ) * (cooccurrence > 0)
    similar_items = {
        item_id: neighbours
        for index, item_id in enumerate(item_ids)
        if (neighbours := build_top_neighbours(blended[index], item_ids, index, NEIGHBOUR_COUNT))
    }
    popularity = (
        weighted.with_columns(
            (pl.col("weight") * (0.5 ** (pl.col("age_days") / POPULARITY_HALF_LIFE_DAYS))).alias("decayed")
        )
        .group_by("product_id")
        .agg(pl.col("decayed").sum())
        .sort(["decayed", "product_id"], descending=[True, False])
        .head(200)
    )
    bundle = ItemSimilarityBundle(
        similar_items=similar_items,
        bought_together_items=build_bought_together_lists(interactions),
        popular_items=[(str(item), round(float(score), 6)) for item, score in popularity.iter_rows()],
        store_customer_topic_centroids=build_store_customer_topic_centroids(location, interactions),
    )
    store_by_item = dict(interactions.select("product_id", "store_id").unique(subset=["product_id"]).iter_rows())
    neighbour_lists = {item: [neighbour for neighbour, _score in pairs] for item, pairs in similar_items.items()}
    recall_at_ten = evaluate_leave_last_out_recall(interactions, similar_items)
    metrics = {
        "recallAt10": recall_at_ten,
        "catalogCoverage": calculate_catalog_coverage(neighbour_lists, set(item_ids)),
        "intraListStoreDiversity": calculate_intra_list_diversity(neighbour_lists, store_by_item),
        "itemsWithNeighbours": len(similar_items),
        "storesWithLookalikeCentroid": len(bundle.store_customer_topic_centroids),
    }
    return register_and_maybe_activate_model(
        registry,
        "item_similarity",
        bundle,
        metrics,
        "recallAt10",
        recall_at_ten,
        {"rows": interactions.height, "users": len(user_ids), "items": len(item_ids), "alsFactors": 16},
        force_activation,
    )
