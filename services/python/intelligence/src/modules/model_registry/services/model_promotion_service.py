import logging
import platform
from datetime import UTC, datetime
from typing import Any

import numpy
import polars
import sklearn

from src.modules.model_registry.repositories.model_registry_repository import ModelRegistry

promotion_logger = logging.getLogger("intelligence.pipeline.promotion")
MINIMUM_PRIMARY_METRIC = {"auc": 0.55, "recallAt10": 0.01}
MAXIMUM_ALLOWED_REGRESSION = 0.01


def describe_training_environment() -> dict[str, str]:
    return {
        "python": platform.python_version(),
        "numpy": numpy.__version__,
        "polars": polars.__version__,
        "scikitLearn": sklearn.__version__,
    }


def decide_whether_to_activate(
    registry: ModelRegistry, model_name: str, primary_metric_name: str, primary_metric_value: float | None
) -> tuple[bool, str]:
    if primary_metric_value is None:
        return False, "primary_metric_unavailable"
    if primary_metric_value < MINIMUM_PRIMARY_METRIC[primary_metric_name]:
        return False, "below_minimum_quality"
    active_version = registry.read_active_version(model_name)
    if active_version is None:
        return True, "no_active_version"
    active_metrics = registry.read_version_metadata(model_name, active_version).get("primaryMetric", {})
    active_value = active_metrics.get("value")
    if isinstance(active_value, int | float) and primary_metric_value < active_value - MAXIMUM_ALLOWED_REGRESSION:
        return False, "regressed_against_active_version"
    return True, "passed_quality_gate"


def register_and_maybe_activate_model(
    registry: ModelRegistry,
    model_name: str,
    bundle: object,
    metrics: dict[str, Any],
    primary_metric_name: str,
    primary_metric_value: float | None,
    training_details: dict[str, Any],
    force_activation: bool,
) -> dict[str, Any]:
    should_activate, decision_reason = decide_whether_to_activate(
        registry, model_name, primary_metric_name, primary_metric_value
    )
    metadata = {
        "metrics": metrics,
        "primaryMetric": {"name": primary_metric_name, "value": primary_metric_value},
        "training": training_details,
        "environment": describe_training_environment(),
    }
    version = registry.register_model_version(model_name, bundle, metadata, datetime.now(UTC))
    activated = should_activate or force_activation
    if activated:
        registry.activate_model_version(model_name, version)
    promotion_logger.info(
        "model_registered",
        extra={"model_name": model_name, "model_version": version, "activated": activated, "reason": decision_reason},
    )
    return {"modelName": model_name, "version": version, "activated": activated, "decision": decision_reason}
