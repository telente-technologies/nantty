from collections.abc import Mapping, Sequence
from dataclasses import dataclass

import numpy as np
import numpy.typing as npt

from src.modules.model_registry.models.model_bundle_model import MultiHeadClassifierBundle


@dataclass(frozen=True)
class HeuristicLogisticHeads:
    feature_names: tuple[str, ...]
    intercept_and_weights_by_head: Mapping[str, tuple[float, Mapping[str, float]]]

    def predict_head_probabilities(self, feature_matrix: npt.NDArray[np.float64]) -> dict[str, npt.NDArray[np.float64]]:
        feature_index_by_name = {name: index for index, name in enumerate(self.feature_names)}
        probabilities_by_head: dict[str, npt.NDArray[np.float64]] = {}
        for head_name, (intercept, weights_by_feature) in self.intercept_and_weights_by_head.items():
            weight_vector = np.zeros(len(self.feature_names), dtype=np.float64)
            for feature_name, weight in weights_by_feature.items():
                weight_vector[feature_index_by_name[feature_name]] = weight
            logits = np.clip(feature_matrix @ weight_vector + intercept, -30.0, 30.0)
            probabilities_by_head[head_name] = 1.0 / (1.0 + np.exp(-logits))
        return probabilities_by_head


@dataclass(frozen=True)
class HeadPredictionResult:
    probabilities_by_head: dict[str, npt.NDArray[np.float64]]
    ranking_source: str
    model_version: str | None


def predict_heads_with_model_or_heuristic(
    feature_rows: Sequence[Sequence[float]],
    expected_feature_names: tuple[str, ...],
    trained_bundle: object | None,
    trained_model_version: str | None,
    heuristic_heads: HeuristicLogisticHeads,
) -> HeadPredictionResult:
    feature_matrix = np.asarray(feature_rows, dtype=np.float64).reshape(len(feature_rows), len(expected_feature_names))
    if (
        isinstance(trained_bundle, MultiHeadClassifierBundle)
        and trained_bundle.feature_names == expected_feature_names
        and set(trained_bundle.heads) >= set(heuristic_heads.intercept_and_weights_by_head)
        and len(feature_rows) > 0
    ):
        try:
            return HeadPredictionResult(
                trained_bundle.predict_head_probabilities(feature_matrix), "model", trained_model_version
            )
        except ValueError, AttributeError, TypeError:
            pass
    return HeadPredictionResult(heuristic_heads.predict_head_probabilities(feature_matrix), "heuristic", None)


def blend_head_probabilities(
    probabilities_by_head: Mapping[str, npt.NDArray[np.float64]], blend_weight_by_head: Mapping[str, float]
) -> npt.NDArray[np.float64]:
    total_weight = sum(blend_weight_by_head.values())
    first_head = next(iter(probabilities_by_head.values()))
    blended = np.zeros_like(first_head)
    for head_name, weight in blend_weight_by_head.items():
        blended += probabilities_by_head[head_name] * weight
    return blended / total_weight
