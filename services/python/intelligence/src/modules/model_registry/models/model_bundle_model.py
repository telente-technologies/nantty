from dataclasses import dataclass, field
from typing import Any, Literal

import numpy as np
import numpy.typing as npt

type RegisteredModelName = Literal["feed_engagement", "clip_watch", "ad_click", "order_risk", "item_similarity"]

REGISTERED_MODEL_NAMES: tuple[RegisteredModelName, ...] = (
    "feed_engagement",
    "clip_watch",
    "ad_click",
    "order_risk",
    "item_similarity",
)


@dataclass(frozen=True)
class MultiHeadClassifierBundle:
    feature_names: tuple[str, ...]
    feature_schema_version: int
    heads: dict[str, Any]

    def predict_head_probabilities(self, feature_matrix: npt.NDArray[np.float64]) -> dict[str, npt.NDArray[np.float64]]:
        probabilities_by_head: dict[str, npt.NDArray[np.float64]] = {}
        for head_name, estimator in self.heads.items():
            raw_probabilities = np.asarray(estimator.predict_proba(feature_matrix), dtype=np.float64)
            probabilities_by_head[head_name] = raw_probabilities[:, 1]
        return probabilities_by_head


@dataclass(frozen=True)
class ItemSimilarityBundle:
    similar_items: dict[str, list[tuple[str, float]]] = field(default_factory=dict)
    bought_together_items: dict[str, list[tuple[str, float]]] = field(default_factory=dict)
    popular_items: list[tuple[str, float]] = field(default_factory=list)
    store_customer_topic_centroids: dict[str, dict[str, float]] = field(default_factory=dict)


@dataclass(frozen=True)
class LoadedModel:
    model_name: str
    version: str
    metadata: dict[str, Any]
    bundle: Any


@dataclass(frozen=True)
class ConstantProbabilityClassifier:
    positive_probability: float

    def predict_proba(self, feature_matrix: npt.NDArray[np.float64]) -> npt.NDArray[np.float64]:
        row_count = feature_matrix.shape[0]
        positive = np.full(row_count, self.positive_probability, dtype=np.float64)
        return np.column_stack([1.0 - positive, positive])
