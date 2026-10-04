import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pytest

from src.modules.model_registry.models.model_bundle_model import (
    ConstantProbabilityClassifier,
    MultiHeadClassifierBundle,
)
from src.modules.model_registry.repositories.model_registry_repository import ModelArtifactRejectedError, ModelRegistry
from src.modules.model_registry.services.active_model_holder_service import ActiveModelHolder

SIGNING_SECRET = "model-signing-secret-for-tests-000000000"


def build_bundle(probability: float) -> MultiHeadClassifierBundle:
    return MultiHeadClassifierBundle(("feature_a",), 1, {"click": ConstantProbabilityClassifier(probability)})


def register_bundle(registry: ModelRegistry, probability: float, second: int = 0) -> str:
    return registry.register_model_version(
        "ad_click", build_bundle(probability), {"metrics": {}}, datetime(2026, 9, 1, 0, 0, second, tzinfo=UTC)
    )


def test_registered_version_round_trips_with_signature(tmp_path: Path) -> None:
    registry = ModelRegistry(tmp_path, SIGNING_SECRET)
    version = register_bundle(registry, 0.2)
    registry.activate_model_version("ad_click", version)
    loaded = registry.load_model_version("ad_click", registry.read_active_version("ad_click") or "")
    probabilities = loaded.bundle.predict_head_probabilities(np.zeros((2, 1)))
    assert probabilities["click"].tolist() == [0.2, 0.2]
    assert loaded.metadata["artifactSignature"]


def test_tampered_artifact_is_rejected(tmp_path: Path) -> None:
    registry = ModelRegistry(tmp_path, SIGNING_SECRET)
    version = register_bundle(registry, 0.2)
    artifact_path = tmp_path / "ad_click" / version / "artifact.pkl"
    artifact_path.write_bytes(artifact_path.read_bytes() + b"tampered")
    with pytest.raises(ModelArtifactRejectedError, match="artifact_digest_mismatch"):
        registry.load_model_version("ad_click", version)


def test_forged_metadata_without_valid_signature_is_rejected(tmp_path: Path) -> None:
    unsigned_registry = ModelRegistry(tmp_path, "")
    version = register_bundle(unsigned_registry, 0.2)
    with pytest.raises(ModelArtifactRejectedError, match="artifact_signature_missing"):
        ModelRegistry(tmp_path, SIGNING_SECRET).load_model_version("ad_click", version)
    metadata_path = tmp_path / "ad_click" / version / "metadata.json"
    metadata = json.loads(metadata_path.read_text())
    metadata["artifactSignature"] = "0" * 64
    metadata_path.write_text(json.dumps(metadata))
    with pytest.raises(ModelArtifactRejectedError, match="artifact_signature_mismatch"):
        ModelRegistry(tmp_path, SIGNING_SECRET).load_model_version("ad_click", version)


def test_models_trained_with_other_scikit_learn_versions_are_rejected(tmp_path: Path) -> None:
    registry = ModelRegistry(tmp_path, SIGNING_SECRET)
    version = registry.register_model_version(
        "ad_click", build_bundle(0.1), {"environment": {"scikitLearn": "0.0.1"}}, datetime(2026, 9, 1, tzinfo=UTC)
    )
    with pytest.raises(ModelArtifactRejectedError, match="incompatible_scikit_learn_version"):
        registry.load_model_version("ad_click", version)


def test_activation_rejects_unknown_or_malformed_versions(tmp_path: Path) -> None:
    registry = ModelRegistry(tmp_path, SIGNING_SECRET)
    with pytest.raises(ModelArtifactRejectedError):
        registry.activate_model_version("ad_click", "../../etc/passwd")
    with pytest.raises(ModelArtifactRejectedError):
        registry.activate_model_version("ad_click", "20260101T000000Z-deadbeef")


async def test_holder_hot_reloads_when_active_pointer_changes(tmp_path: Path) -> None:
    registry = ModelRegistry(tmp_path, SIGNING_SECRET)
    holder = ActiveModelHolder(registry)
    assert await holder.reload_changed_models() == []
    first_version = register_bundle(registry, 0.2, second=1)
    registry.activate_model_version("ad_click", first_version)
    assert await holder.reload_changed_models() == ["ad_click"]
    assert await holder.reload_changed_models() == []
    second_version = register_bundle(registry, 0.7, second=2)
    registry.activate_model_version("ad_click", second_version)
    await holder.reload_changed_models()
    assert holder.get_active_version("ad_click") == second_version
    assert holder.describe_loaded_models()["ad_click"]["version"] == second_version


async def test_holder_keeps_serving_previous_model_when_new_artifact_is_corrupt(tmp_path: Path) -> None:
    registry = ModelRegistry(tmp_path, SIGNING_SECRET)
    holder = ActiveModelHolder(registry)
    good_version = register_bundle(registry, 0.2, second=1)
    registry.activate_model_version("ad_click", good_version)
    await holder.reload_changed_models()
    bad_version = register_bundle(registry, 0.9, second=2)
    (tmp_path / "ad_click" / bad_version / "artifact.pkl").write_bytes(b"corrupt")
    registry.activate_model_version("ad_click", bad_version)
    await holder.reload_changed_models()
    assert holder.get_active_version("ad_click") == good_version
