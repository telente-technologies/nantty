import asyncio
import json
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from src.configs.settings_config import IntelligenceSettings, load_intelligence_settings
from src.container import build_application_container
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.integrations.dataset_storage_integration import build_local_dataset_storage_location
from src.jobs.compact_datasets_job import compact_small_parquet_files
from src.jobs.generate_synthetic_data_job import generate_synthetic_dataset
from src.jobs.pipeline_cli_job import main as run_pipeline_command
from src.modules.feed.dtos.feed_ranking_dto import FeedRankingRequest
from src.modules.feed.services.feed_feature_vector_service import FEED_FEATURE_NAMES, FEED_FEATURE_SCHEMA_VERSION
from src.modules.model_registry.models.model_bundle_model import REGISTERED_MODEL_NAMES
from src.utils.training_dataset_builder_util import build_feed_training_dataset


@pytest.fixture(scope="module")
def trained_workspace(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Any]:
    workspace = tmp_path_factory.mktemp("pipeline")
    storage = workspace / "data"
    registry = workspace / "registry"
    summary = asyncio.run(generate_synthetic_dataset(storage, user_count=24, sessions_per_user=3, seed=11))
    previous_env = dict(os.environ)
    os.environ["INTELLIGENCE_SHARED_SECRET"] = "pipeline-test-secret-00000000000000000000"
    os.environ["INTELLIGENCE_MODEL_SIGNING_SECRET"] = "pipeline-test-model-signing-secret-000000"
    load_intelligence_settings.cache_clear()
    try:
        exit_code = run_pipeline_command(
            ["--storage", str(storage), "--registry", str(registry), "train", "--force-activation"]
        )
    finally:
        os.environ.clear()
        os.environ.update(previous_env)
        load_intelligence_settings.cache_clear()
    return {"storage": storage, "registry": registry, "summary": summary, "exit_code": exit_code}


def read_active_metadata(registry: Path, model_name: str) -> dict[str, Any]:
    version = (registry / model_name / "ACTIVE").read_text().strip()
    metadata: dict[str, Any] = json.loads((registry / model_name / version / "metadata.json").read_text())
    return metadata


def test_synthetic_generation_produces_events_and_feature_logs(trained_workspace: dict[str, Any]) -> None:
    assert trained_workspace["summary"].accepted_event_count > 500
    assert trained_workspace["summary"].rejected_event_count == 0
    dataset = build_feed_training_dataset(
        build_local_dataset_storage_location(str(trained_workspace["storage"])),
        FEED_FEATURE_SCHEMA_VERSION,
        len(FEED_FEATURE_NAMES),
    )
    assert dataset.row_count > 100
    assert set(dataset.labels) == {"long_dwell", "like", "comment", "share", "purchase_intent"}


def test_every_model_is_trained_evaluated_and_activated(trained_workspace: dict[str, Any]) -> None:
    assert trained_workspace["exit_code"] == 0
    for model_name in REGISTERED_MODEL_NAMES:
        metadata = read_active_metadata(trained_workspace["registry"], model_name)
        assert metadata["artifactSha256"]
        assert metadata["environment"]["scikitLearn"]
        assert metadata["primaryMetric"]["name"] in {"auc", "recallAt10"}
    feed_metrics = read_active_metadata(trained_workspace["registry"], "feed_engagement")["metrics"]
    assert feed_metrics["like"]["auc"] > 0.6
    assert 0.0 <= feed_metrics["like"]["expectedCalibrationError"] <= 0.3
    assert feed_metrics["ranking"]["ndcgAt10"] is not None
    similarity_metrics = read_active_metadata(trained_workspace["registry"], "item_similarity")["metrics"]
    assert similarity_metrics["catalogCoverage"] > 0.2


async def test_online_service_hot_loads_trained_models(trained_workspace: dict[str, Any], tmp_path: Path) -> None:
    settings = IntelligenceSettings(
        environment="test",
        shared_secret="pipeline-test-secret-000000000000000000",
        event_storage_uri=str(tmp_path / "serving"),
        model_registry_path=trained_workspace["registry"],
    )
    container = build_application_container(settings, InMemoryFeatureBackend())
    assert sorted(await container.model_holder.reload_changed_models()) == sorted(REGISTERED_MODEL_NAMES)
    now = datetime.now(UTC)
    request = FeedRankingRequest.model_validate(
        {
            "viewer": {"userId": "user_0001", "chosenTopics": ["fashion"]},
            "candidates": [
                {
                    "itemId": f"post_{index}",
                    "authorId": f"creator_{index % 4}",
                    "createdAt": (now - timedelta(hours=index)).isoformat(),
                    "topics": ["fashion"],
                    "likeCount": index,
                    "viewCount": 50,
                }
                for index in range(20)
            ],
        }
    )
    response = await container.feed_ranking_service.rank_feed(request)
    assert response.metadata.ranking_source == "for_you:model"
    assert response.metadata.model_version == container.model_holder.get_active_version("feed_engagement")
    assert len(response.items) == 20


def test_compaction_merges_small_files_without_losing_rows(trained_workspace: dict[str, Any]) -> None:
    location = build_local_dataset_storage_location(str(trained_workspace["storage"]))
    before = build_feed_training_dataset(location, FEED_FEATURE_SCHEMA_VERSION, len(FEED_FEATURE_NAMES)).row_count
    compacted = compact_small_parquet_files(location, timedelta(days=-1))
    after = build_feed_training_dataset(location, FEED_FEATURE_SCHEMA_VERSION, len(FEED_FEATURE_NAMES)).row_count
    assert compacted["raw_events"] > 0
    assert after == before
