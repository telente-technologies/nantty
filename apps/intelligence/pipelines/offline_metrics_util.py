import math
from collections import defaultdict
from collections.abc import Mapping, Sequence

import numpy as np
import numpy.typing as npt
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score

CALIBRATION_BIN_COUNT = 10


def calculate_expected_calibration_error(
    labels: npt.NDArray[np.int8], predicted_probabilities: npt.NDArray[np.float64]
) -> float:
    bin_edges = np.linspace(0.0, 1.0, CALIBRATION_BIN_COUNT + 1)
    bin_indices = np.clip(np.digitize(predicted_probabilities, bin_edges[1:-1]), 0, CALIBRATION_BIN_COUNT - 1)
    total_count = len(labels)
    calibration_error = 0.0
    for bin_index in range(CALIBRATION_BIN_COUNT):
        in_bin = bin_indices == bin_index
        bin_count = int(in_bin.sum())
        if bin_count == 0:
            continue
        observed_rate = float(labels[in_bin].mean())
        predicted_rate = float(predicted_probabilities[in_bin].mean())
        calibration_error += bin_count / total_count * abs(observed_rate - predicted_rate)
    return calibration_error


def calculate_binary_classification_metrics(
    labels: npt.NDArray[np.int8], predicted_probabilities: npt.NDArray[np.float64]
) -> dict[str, float | None]:
    if len(labels) == 0:
        return {"rows": 0.0, "auc": None, "logLoss": None, "brier": None, "expectedCalibrationError": None}
    clipped = np.clip(predicted_probabilities, 1e-6, 1 - 1e-6)
    both_classes_present = len(np.unique(labels)) == 2
    return {
        "rows": float(len(labels)),
        "baseRate": float(labels.mean()),
        "meanPrediction": float(clipped.mean()),
        "auc": float(roc_auc_score(labels, clipped)) if both_classes_present else None,
        "logLoss": float(log_loss(labels, clipped, labels=[0, 1])),
        "brier": float(brier_score_loss(labels, clipped)),
        "expectedCalibrationError": calculate_expected_calibration_error(labels, clipped),
    }


def calculate_discounted_cumulative_gain(relevance_in_ranked_order: Sequence[float], cutoff: int) -> float:
    return float(
        sum(
            (2.0 ** float(relevance) - 1.0) / math.log2(position + 2.0)
            for position, relevance in enumerate(relevance_in_ranked_order[:cutoff])
        )
    )


def calculate_mean_ndcg_at_k(
    group_ids: npt.NDArray[np.str_],
    graded_relevance: npt.NDArray[np.float64],
    predicted_scores: npt.NDArray[np.float64],
    cutoff: int,
) -> float | None:
    rows_by_group: dict[str, list[int]] = defaultdict(list)
    for row_index, group_id in enumerate(group_ids.tolist()):
        rows_by_group[str(group_id)].append(row_index)
    ndcg_values: list[float] = []
    for row_indices in rows_by_group.values():
        relevance = graded_relevance[row_indices]
        if relevance.max() <= 0:
            continue
        predicted_order = np.argsort(-predicted_scores[row_indices], kind="stable")
        ideal_gain = calculate_discounted_cumulative_gain(sorted(relevance.tolist(), reverse=True), cutoff)
        actual_gain = calculate_discounted_cumulative_gain(relevance[predicted_order].tolist(), cutoff)
        ndcg_values.append(actual_gain / ideal_gain)
    return float(np.mean(ndcg_values)) if ndcg_values else None


def calculate_catalog_coverage(recommendation_lists: Mapping[str, Sequence[str]], catalog: set[str]) -> float:
    if not catalog:
        return 0.0
    recommended_items = {item for items in recommendation_lists.values() for item in items}
    return len(recommended_items & catalog) / len(catalog)


def calculate_intra_list_diversity(
    recommendation_lists: Mapping[str, Sequence[str]], group_by_item: Mapping[str, str]
) -> float | None:
    diversity_values: list[float] = []
    for items in recommendation_lists.values():
        groups = [group_by_item.get(item, item) for item in items]
        pair_count = len(groups) * (len(groups) - 1) / 2
        if pair_count == 0:
            continue
        different_pairs = sum(
            1
            for first in range(len(groups))
            for second in range(first + 1, len(groups))
            if groups[first] != groups[second]
        )
        diversity_values.append(different_pairs / pair_count)
    return float(np.mean(diversity_values)) if diversity_values else None
