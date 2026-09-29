from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import numpy as np
import numpy.typing as npt
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from src.configs.ranking_heuristics_config import (
    AD_CLICK_HEURISTIC_HEADS,
    CLIP_HEURISTIC_HEADS,
    FEED_ENGAGEMENT_BLEND_WEIGHTS,
    FEED_HEURISTIC_HEADS,
)
from src.integrations.dataset_storage_integration import DatasetStorageLocation
from src.modules.ads.services.ad_feature_vector_service import AD_FEATURE_NAMES, AD_FEATURE_SCHEMA_VERSION
from src.modules.clips.services.clip_feature_vector_service import CLIP_FEATURE_NAMES, CLIP_FEATURE_SCHEMA_VERSION
from src.modules.feed.services.feed_feature_vector_service import FEED_FEATURE_NAMES, FEED_FEATURE_SCHEMA_VERSION
from src.modules.model_registry.models.model_bundle_model import (
    ConstantProbabilityClassifier,
    MultiHeadClassifierBundle,
)
from src.modules.model_registry.repositories.model_registry_repository import ModelRegistry
from src.modules.model_registry.services.model_promotion_service import register_and_maybe_activate_model
from src.modules.risk.services.risk_rules_service import ORDER_RISK_FEATURE_NAMES, ORDER_RISK_FEATURE_SCHEMA_VERSION
from src.services.head_probability_predictor_service import HeuristicLogisticHeads, blend_head_probabilities
from src.utils.offline_metrics_util import calculate_binary_classification_metrics, calculate_mean_ndcg_at_k
from src.utils.training_dataset_builder_util import (
    TrainingDataset,
    build_ad_click_training_dataset,
    build_clip_training_dataset,
    build_feed_training_dataset,
    build_order_risk_training_dataset,
)

TEST_FRACTION = 0.2
MINIMUM_TRAINING_ROWS = 30
FEED_GRADED_RELEVANCE = {"purchase_intent": 4.0, "share": 3.0, "comment": 2.0, "like": 1.0, "long_dwell": 1.0}


@dataclass(frozen=True)
class ClassifierTrainingSpecification:
    model_name: str
    feature_names: tuple[str, ...]
    feature_schema_version: int
    head_names: tuple[str, ...]
    primary_head: str
    build_dataset: Callable[[DatasetStorageLocation, int, int], TrainingDataset]
    build_estimator: Callable[[], Any]
    heuristic_baseline: HeuristicLogisticHeads | None


def build_gradient_boosted_trees() -> HistGradientBoostingClassifier:
    return HistGradientBoostingClassifier(
        max_iter=60, learning_rate=0.12, max_leaf_nodes=15, min_samples_leaf=20, l2_regularization=1.0, random_state=0
    )


def build_scaled_logistic_regression() -> Any:
    return make_pipeline(StandardScaler(), LogisticRegression(C=1.0, max_iter=500))


CLASSIFIER_TRAINING_SPECIFICATIONS: dict[str, ClassifierTrainingSpecification] = {
    "feed_engagement": ClassifierTrainingSpecification(
        "feed_engagement",
        FEED_FEATURE_NAMES,
        FEED_FEATURE_SCHEMA_VERSION,
        ("like", "comment", "share", "long_dwell", "purchase_intent"),
        "like",
        build_feed_training_dataset,
        build_gradient_boosted_trees,
        FEED_HEURISTIC_HEADS,
    ),
    "clip_watch": ClassifierTrainingSpecification(
        "clip_watch",
        CLIP_FEATURE_NAMES,
        CLIP_FEATURE_SCHEMA_VERSION,
        ("completion", "rewatch"),
        "completion",
        build_clip_training_dataset,
        build_gradient_boosted_trees,
        CLIP_HEURISTIC_HEADS,
    ),
    "ad_click": ClassifierTrainingSpecification(
        "ad_click",
        AD_FEATURE_NAMES,
        AD_FEATURE_SCHEMA_VERSION,
        ("click",),
        "click",
        build_ad_click_training_dataset,
        build_scaled_logistic_regression,
        AD_CLICK_HEURISTIC_HEADS,
    ),
    "order_risk": ClassifierTrainingSpecification(
        "order_risk",
        ORDER_RISK_FEATURE_NAMES,
        ORDER_RISK_FEATURE_SCHEMA_VERSION,
        ("fraud",),
        "fraud",
        build_order_risk_training_dataset,
        build_scaled_logistic_regression,
        None,
    ),
}


def split_rows_by_time(
    logged_at_seconds: npt.NDArray[np.float64],
) -> tuple[npt.NDArray[np.int64], npt.NDArray[np.int64]]:
    ordered_rows = np.argsort(logged_at_seconds, kind="stable")
    test_row_count = max(int(len(ordered_rows) * TEST_FRACTION), 1)
    return ordered_rows[:-test_row_count], ordered_rows[-test_row_count:]


def fit_head(
    specification: ClassifierTrainingSpecification, features: npt.NDArray[np.float64], labels: npt.NDArray[np.int8]
) -> Any:
    if len(np.unique(labels)) < 2:
        return ConstantProbabilityClassifier(float(labels.mean()) if len(labels) else 0.0)
    estimator = specification.build_estimator()
    estimator.fit(features, labels)
    return estimator


def evaluate_feed_ranking_quality(
    dataset: TrainingDataset,
    test_rows: npt.NDArray[np.int64],
    probabilities_by_head: dict[str, npt.NDArray[np.float64]],
    baseline: HeuristicLogisticHeads,
) -> dict[str, float | None]:
    graded_relevance = np.zeros(len(test_rows))
    for head_name, relevance in FEED_GRADED_RELEVANCE.items():
        graded_relevance = np.maximum(graded_relevance, dataset.labels[head_name][test_rows] * relevance)
    model_scores = blend_head_probabilities(probabilities_by_head, FEED_ENGAGEMENT_BLEND_WEIGHTS)
    baseline_scores = blend_head_probabilities(
        baseline.predict_head_probabilities(dataset.features[test_rows]), FEED_ENGAGEMENT_BLEND_WEIGHTS
    )
    group_ids = dataset.group_ids[test_rows]
    return {
        "ndcgAt10": calculate_mean_ndcg_at_k(group_ids, graded_relevance, model_scores, 10),
        "heuristicNdcgAt10": calculate_mean_ndcg_at_k(group_ids, graded_relevance, baseline_scores, 10),
    }


def train_classifier_model(
    location: DatasetStorageLocation,
    registry: ModelRegistry,
    specification: ClassifierTrainingSpecification,
    force_activation: bool,
) -> dict[str, Any]:
    dataset = specification.build_dataset(
        location, specification.feature_schema_version, len(specification.feature_names)
    )
    if dataset.row_count < MINIMUM_TRAINING_ROWS:
        return {"modelName": specification.model_name, "skipped": "not_enough_rows", "rows": dataset.row_count}
    train_rows, test_rows = split_rows_by_time(dataset.logged_at_seconds)
    heads: dict[str, Any] = {}
    metrics: dict[str, Any] = {}
    test_probabilities: dict[str, npt.NDArray[np.float64]] = {}
    for head_name in specification.head_names:
        head_labels = dataset.labels[head_name]
        evaluation_head = fit_head(specification, dataset.features[train_rows], head_labels[train_rows])
        test_probabilities[head_name] = np.asarray(evaluation_head.predict_proba(dataset.features[test_rows]))[:, 1]
        metrics[head_name] = calculate_binary_classification_metrics(
            head_labels[test_rows], test_probabilities[head_name]
        )
        heads[head_name] = fit_head(specification, dataset.features, head_labels)
    if specification.model_name == "feed_engagement" and specification.heuristic_baseline is not None:
        metrics["ranking"] = evaluate_feed_ranking_quality(
            dataset, test_rows, test_probabilities, specification.heuristic_baseline
        )
    bundle = MultiHeadClassifierBundle(specification.feature_names, specification.feature_schema_version, heads)
    return register_and_maybe_activate_model(
        registry,
        specification.model_name,
        bundle,
        metrics,
        "auc",
        metrics[specification.primary_head].get("auc"),
        {
            "rows": dataset.row_count,
            "trainRows": len(train_rows),
            "testRows": len(test_rows),
            "featureNames": list(specification.feature_names),
            "featureSchemaVersion": specification.feature_schema_version,
            "split": "time_ordered_last_20_percent",
        },
        force_activation,
    )
