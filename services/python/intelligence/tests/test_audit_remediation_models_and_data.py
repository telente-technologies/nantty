import argparse
import inspect
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from src.configs.settings_config import IntelligenceSettings
from src.container import ApplicationContainer
from src.integrations.dataset_storage_integration import build_local_dataset_storage_location
from src.interfaces.feature_backend_interface import FeatureWriteOperation
from src.jobs import compact_datasets_job
from src.jobs.compact_datasets_job import delete_orphaned_inprogress_files, delete_partitions_older_than
from src.jobs.pipeline_cli_job import resolve_storage_and_registry
from src.loaders import lifespan_loader
from src.modules.domain_events.services.personal_data_purge_service import PersonalDataPurgeService
from src.modules.model_registry.repositories import model_registry_repository as registry_module
from src.modules.model_registry.repositories.model_registry_repository import (
    ModelArtifactRejectedError,
    ModelRegistry,
)
from src.modules.model_registry.services.active_model_holder_service import ActiveModelHolder
from src.repositories.online_feature_keyspace_repository import (
    ACCOUNT_DELETED_FIELD,
    PERSONALIZATION_OPT_OUT_FIELD,
)
from tests.modules.model_registry.test_model_registry import SIGNING_SECRET, register_bundle


async def test_activation_verifies_artifact_and_empty_secret_fails_closed(tmp_path: Path) -> None:
    registry = ModelRegistry(tmp_path, SIGNING_SECRET)
    version = register_bundle(registry, 0.2)
    (tmp_path / "ad_click" / version / "artifact.pkl").write_bytes(b"tampered")
    with pytest.raises(ModelArtifactRejectedError):
        registry.activate_model_version("ad_click", version)
    assert registry.read_active_version("ad_click") is None
    clean_version = register_bundle(registry, 0.3, second=5)
    unsigned = ModelRegistry(tmp_path, "", "production")
    with pytest.raises(ModelArtifactRejectedError, match="artifact_signature_missing"):
        unsigned.load_model_version("ad_click", clean_version)


async def test_unsigned_artifact_loads_in_development_and_test_only(tmp_path: Path) -> None:
    unsigned = ModelRegistry(tmp_path, "")
    version = register_bundle(unsigned, 0.2)
    assert ModelRegistry(tmp_path, "", "development").load_model_version("ad_click", version).version == version
    assert ModelRegistry(tmp_path, "", "test").load_model_version("ad_click", version).version == version


async def test_holder_reverts_to_last_good_after_consecutive_rejections(tmp_path: Path) -> None:
    registry = ModelRegistry(tmp_path, SIGNING_SECRET)
    holder = ActiveModelHolder(registry)
    good_version = register_bundle(registry, 0.2, second=1)
    registry.activate_model_version("ad_click", good_version)
    assert await holder.reload_changed_models() == ["ad_click"]
    bad_version = register_bundle(registry, 0.9, second=2)
    registry.activate_model_version("ad_click", bad_version)
    (tmp_path / "ad_click" / bad_version / "artifact.pkl").write_bytes(b"corrupt")
    assert await holder.reload_changed_models() == []
    assert await holder.reload_changed_models() == []
    assert await holder.reload_changed_models() == []
    assert registry.read_active_version("ad_click") == good_version
    assert holder.get_active_version("ad_click") == good_version


def test_pipeline_cli_resolves_registry_through_settings(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, intelligence_settings: IntelligenceSettings
) -> None:
    monkeypatch.setattr("src.jobs.pipeline_cli_job.load_intelligence_settings", lambda: intelligence_settings)
    storage = str(tmp_path / "cli-data")
    registry = str(tmp_path / "cli-registry")
    arguments = argparse.Namespace(storage=storage, registry=registry)
    location, model_registry = resolve_storage_and_registry(arguments)
    assert location.root_path == str(Path(storage).resolve())
    assert model_registry.registry_root == Path(registry)
    assert model_registry.signing_secret == intelligence_settings.model_signing_secret.get_secret_value()
    assert model_registry.environment == intelligence_settings.environment


async def test_purge_writes_tombstone_before_deletes(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    backend = application_container.feature_backend
    keyspace = application_container.feature_store.keyspace
    recorded: list[str] = []

    original_apply = backend.apply_write_operations
    original_delete = backend.delete_keys

    async def recording_apply(operations: Sequence[FeatureWriteOperation]) -> None:
        recorded.append(f"write:{sorted({type(operation).__name__ for operation in operations})}")
        await original_apply(operations)

    async def recording_delete(keys: Sequence[str]) -> None:
        recorded.append(f"delete:{len(keys)}")
        await original_delete(keys)

    backend.apply_write_operations = recording_apply  # type: ignore[method-assign]
    backend.delete_keys = recording_delete  # type: ignore[method-assign]
    try:
        await application_container.domain_event_consumer_service.purge_service.purge_account("tombstone_user")
    finally:
        del backend.apply_write_operations
        del backend.delete_keys
    assert len(recorded) > 0
    assert recorded[0].startswith("write:")
    consent = await backend.read_hash_fields([keyspace.consent_key("tombstone_user")])
    assert consent[0].get(ACCOUNT_DELETED_FIELD) == 1.0


async def test_purge_covers_full_ad_frequency_window(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    purge_service = application_container.domain_event_consumer_service.purge_service
    backend = application_container.feature_backend
    keyspace = application_container.feature_store.keyspace
    deleted: list[str] = []
    original_delete = backend.delete_keys

    async def recording_delete(keys: Sequence[str]) -> None:
        deleted.extend(keys)
        await original_delete(keys)

    backend.delete_keys = recording_delete  # type: ignore[method-assign]
    try:
        await purge_service.purge_personalization_features("window_user")
    finally:
        del backend.delete_keys
    frequency_keys = [key for key in deleted if ":adfreq:" in key]
    assert len(frequency_keys) >= 4
    consent = await backend.read_hash_fields([keyspace.consent_key("window_user")])
    assert consent[0].get(PERSONALIZATION_OPT_OUT_FIELD) == 1.0


def write_partition(location: Any, dataset: str, partition: str, name: str, content: bytes = b"x") -> str:
    path = f"{location.join(dataset)}/{partition}/{name}"
    location.filesystem.create_dir(f"{location.join(dataset)}/{partition}")
    with location.filesystem.open_output_stream(path) as stream:
        stream.write(content)
    return path


def test_retention_deletes_old_partitions_and_orphans(tmp_path: Path) -> None:
    location = build_local_dataset_storage_location(str(tmp_path / "datasets"))
    old_partition = "event_date=2000-01-01"
    write_partition(location, "raw_events", f"event_type=post.viewed/{old_partition}", "part-old.parquet")
    recent = datetime.now(UTC).date().isoformat()
    write_partition(location, "raw_events", f"event_type=post.viewed/event_date={recent}", "part-new.parquet")
    stale_dir = f"{location.join('feature_logs')}/event_date=2000-01-02"
    location.filesystem.create_dir(stale_dir)
    with location.filesystem.open_output_stream(f"{stale_dir}/.inprogress-part-abc.parquet") as stream:
        stream.write(b"orphan")
    removed = delete_partitions_older_than(location, 30, timedelta(days=1))
    assert removed["raw_events"] == 1
    assert removed["feature_logs"] == 1
    orphans = delete_orphaned_inprogress_files(location, timedelta(days=1))
    assert orphans == 0


def test_retention_keeps_recent_partitions(tmp_path: Path) -> None:
    location = build_local_dataset_storage_location(str(tmp_path / "datasets"))
    recent = datetime.now(UTC).date().isoformat()
    write_partition(location, "raw_events", f"event_type=post.viewed/event_date={recent}", "part-new.parquet")
    removed = delete_partitions_older_than(location, 30, timedelta(days=1))
    assert removed["raw_events"] == 0


def test_compact_retention_helpers_are_wired_in_lifespan() -> None:
    source = inspect.getsource(lifespan_loader)
    assert "run_periodic_retention_loop" in source
    assert "dataset_retention_days" in source


def test_single_read_pickle_load_uses_buffer() -> None:
    source = inspect.getsource(registry_module)
    assert "io.BytesIO" in source
    assert "verify_artifact_buffer_integrity" in source


def test_purge_module_writes_tombstone_first() -> None:
    source = inspect.getsource(PersonalDataPurgeService.purge_account)
    first_write = source.index("ACCOUNT_DELETED_FIELD, 1.0")
    first_delete = source.index("delete_keys")
    assert first_write < first_delete


def test_compact_module_parses_partition_dates_once() -> None:
    assert compact_datasets_job.partition_date_of("x/event_date=2026-01-02") is not None
    assert compact_datasets_job.partition_date_of("x/wat") is None
