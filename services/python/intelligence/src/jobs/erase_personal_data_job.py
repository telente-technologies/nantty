import asyncio
import logging
import time

import pyarrow as arrow
import pyarrow.compute as arrow_compute
import pyarrow.parquet as arrow_parquet
from pyarrow import fs as arrow_filesystem

from src.integrations.dataset_storage_integration import DatasetStorageLocation
from src.interfaces.feature_backend_interface import FeatureBackend
from src.jobs.compact_datasets_job import list_partition_directories
from src.modules.events_ingestion.repositories.raw_event_parquet_repository import (
    RAW_EVENT_ARROW_SCHEMA,
    RAW_EVENTS_DATASET_NAME,
)
from src.repositories.feature_log_parquet_repository import FEATURE_LOG_ARROW_SCHEMA, FEATURE_LOGS_DATASET_NAME
from src.repositories.online_feature_keyspace_repository import SECONDS_PER_DAY, OnlineFeatureKeyspace
from src.utils.parquet_storage_util import write_parquet_table_atomically

erasure_logger = logging.getLogger("intelligence.datasets.erasure")
ERASABLE_DATASETS = (
    (RAW_EVENTS_DATASET_NAME, RAW_EVENT_ARROW_SCHEMA),
    (FEATURE_LOGS_DATASET_NAME, FEATURE_LOG_ARROW_SCHEMA),
)
PENDING_ERASURE_READ_LIMIT = 100_000


def list_part_files(location: DatasetStorageLocation, directory: str) -> list[str]:
    selector = arrow_filesystem.FileSelector(directory, recursive=False)
    return sorted(
        info.path
        for info in location.filesystem.get_file_info(selector)
        if info.type == arrow_filesystem.FileType.File and info.base_name.startswith("part-")
    )


def erase_actor_rows_from_file(
    location: DatasetStorageLocation, directory: str, path: str, schema: arrow.Schema, actor_ids: arrow.Array
) -> int:
    actor_column = arrow_parquet.read_table(path, filesystem=location.filesystem, columns=["actor_id"])["actor_id"]
    if not arrow_compute.any(arrow_compute.is_in(actor_column, value_set=actor_ids)).as_py():
        return 0
    table = arrow_parquet.read_table(path, filesystem=location.filesystem, schema=schema)
    kept = table.filter(arrow_compute.invert(arrow_compute.is_in(table["actor_id"], value_set=actor_ids)))
    if kept.num_rows > 0:
        write_parquet_table_atomically(location, kept, directory)
    location.filesystem.delete_file(path)
    return int(table.num_rows) - int(kept.num_rows)


def erase_actor_rows(location: DatasetStorageLocation, actor_ids: set[str]) -> dict[str, int]:
    erased: dict[str, int] = {}
    if not actor_ids:
        return erased
    value_set = arrow.array(sorted(actor_ids), type=arrow.string())
    for dataset_name, schema in ERASABLE_DATASETS:
        removed = 0
        for directory in list_partition_directories(location, dataset_name):
            for path in list_part_files(location, directory):
                removed += erase_actor_rows_from_file(location, directory, path, schema, value_set)
        erased[dataset_name] = removed
    return erased


async def read_actor_ids_pending_erasure(
    backend: FeatureBackend, keyspace: OnlineFeatureKeyspace, retention_days: int, now: float
) -> set[str]:
    rows = await backend.read_sorted_set_highest_members(
        [keyspace.pending_dataset_erasure_key()], PENDING_ERASURE_READ_LIMIT
    )
    oldest_relevant = now - (retention_days + 2) * SECONDS_PER_DAY
    return {member for member, requested_at in (rows[0] if rows else []) if requested_at >= oldest_relevant}


async def erase_pending_actors_once(
    location: DatasetStorageLocation, backend: FeatureBackend, keyspace: OnlineFeatureKeyspace, retention_days: int
) -> dict[str, int]:
    actor_ids = await read_actor_ids_pending_erasure(backend, keyspace, retention_days, time.time())
    erased = await asyncio.to_thread(erase_actor_rows, location, actor_ids)
    if any(erased.values()):
        erasure_logger.warning("dataset_rows_erased", extra={"actor_count": len(actor_ids), **erased})
    return erased


async def run_periodic_erasure_loop(
    location: DatasetStorageLocation,
    backend: FeatureBackend,
    keyspace: OnlineFeatureKeyspace,
    retention_days: int,
    interval_seconds: float,
) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            await erase_pending_actors_once(location, backend, keyspace, retention_days)
        except asyncio.CancelledError:
            raise
        except Exception:
            erasure_logger.exception("dataset_erasure_loop_iteration_failed")
