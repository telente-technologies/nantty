import asyncio
import logging
from datetime import UTC, date, datetime, timedelta

import pyarrow as arrow
import pyarrow.parquet as arrow_parquet
from pyarrow import fs as arrow_filesystem

from src.integrations.dataset_storage_integration import DatasetStorageLocation
from src.modules.events_ingestion.repositories.raw_event_parquet_repository import (
    RAW_EVENT_ARROW_SCHEMA,
    RAW_EVENTS_DATASET_NAME,
)
from src.repositories.feature_log_parquet_repository import FEATURE_LOG_ARROW_SCHEMA, FEATURE_LOGS_DATASET_NAME
from src.utils.parquet_storage_util import write_parquet_table_atomically

MINIMUM_FILES_WORTH_COMPACTING = 4
ORPHAN_INPROGRESS_PREFIX = ".inprogress-"

retention_logger = logging.getLogger("intelligence.datasets.retention")


def list_partition_directories(location: DatasetStorageLocation, dataset_name: str) -> list[str]:
    selector = arrow_filesystem.FileSelector(location.join(dataset_name), recursive=True, allow_not_found=True)
    return sorted(
        info.path
        for info in location.filesystem.get_file_info(selector)
        if info.type == arrow_filesystem.FileType.Directory
        and info.base_name.count("=") == 1
        and "_date=" in info.base_name
    )


def partition_date_of(directory: str) -> date | None:
    name = directory.rsplit("=", 1)[-1]
    try:
        return datetime.strptime(name, "%Y-%m-%d").replace(tzinfo=UTC).date()
    except ValueError:
        return None


def compact_partition_directory(location: DatasetStorageLocation, directory: str, schema: arrow.Schema) -> int:
    selector = arrow_filesystem.FileSelector(directory, recursive=False)
    part_files = sorted(
        info.path
        for info in location.filesystem.get_file_info(selector)
        if info.type == arrow_filesystem.FileType.File and info.base_name.startswith("part-")
    )
    if len(part_files) < MINIMUM_FILES_WORTH_COMPACTING:
        return 0
    tables = [arrow_parquet.read_table(path, filesystem=location.filesystem, schema=schema) for path in part_files]
    write_parquet_table_atomically(location, arrow.concat_tables(tables), directory)
    for path in part_files:
        location.filesystem.delete_file(path)
    return len(part_files)


def compact_small_parquet_files(
    location: DatasetStorageLocation, skip_partitions_newer_than: timedelta
) -> dict[str, int]:
    today = datetime.now(UTC).date()
    compacted: dict[str, int] = {}
    for dataset_name, schema in (
        (RAW_EVENTS_DATASET_NAME, RAW_EVENT_ARROW_SCHEMA),
        (FEATURE_LOGS_DATASET_NAME, FEATURE_LOG_ARROW_SCHEMA),
    ):
        merged_file_count = 0
        for directory in list_partition_directories(location, dataset_name):
            partition_date = partition_date_of(directory)
            if partition_date is None or today - partition_date < skip_partitions_newer_than:
                continue
            merged_file_count += compact_partition_directory(location, directory, schema)
        compacted[dataset_name] = merged_file_count
    return compacted


def delete_partitions_older_than(
    location: DatasetStorageLocation, retention_days: int, skip_partitions_newer_than: timedelta
) -> dict[str, int]:
    today = datetime.now(UTC).date()
    removed: dict[str, int] = {}
    for dataset_name in (RAW_EVENTS_DATASET_NAME, FEATURE_LOGS_DATASET_NAME):
        removed_count = 0
        for directory in list_partition_directories(location, dataset_name):
            partition_date = partition_date_of(directory)
            if partition_date is None:
                continue
            age = today - partition_date
            if age.days <= retention_days or age < skip_partitions_newer_than:
                continue
            try:
                location.filesystem.delete_dir(directory)
            except Exception:
                retention_logger.exception("dataset_partition_delete_failed", extra={"directory": directory})
                continue
            removed_count += 1
            retention_logger.warning("dataset_partition_deleted_by_retention", extra={"directory": directory})
        removed[dataset_name] = removed_count
    return removed


def delete_orphaned_inprogress_files(location: DatasetStorageLocation, skip_partitions_newer_than: timedelta) -> int:
    today = datetime.now(UTC).date()
    removed = 0
    for dataset_name in (RAW_EVENTS_DATASET_NAME, FEATURE_LOGS_DATASET_NAME):
        for directory in list_partition_directories(location, dataset_name):
            partition_date = partition_date_of(directory)
            if partition_date is None or today - partition_date < skip_partitions_newer_than:
                continue
            selector = arrow_filesystem.FileSelector(directory, recursive=False)
            for info in location.filesystem.get_file_info(selector):
                if info.type == arrow_filesystem.FileType.File and info.base_name.startswith(ORPHAN_INPROGRESS_PREFIX):
                    try:
                        location.filesystem.delete_file(info.path)
                    except Exception:
                        retention_logger.exception("orphaned_file_delete_failed", extra={"path": info.path})
                        continue
                    removed += 1
    return removed


async def run_periodic_retention_loop(
    location: DatasetStorageLocation, retention_days: int, interval_seconds: float
) -> None:
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            await asyncio.to_thread(delete_partitions_older_than, location, retention_days, timedelta(days=1))
            await asyncio.to_thread(delete_orphaned_inprogress_files, location, timedelta(days=1))
        except asyncio.CancelledError:
            raise
        except Exception:
            retention_logger.exception("dataset_retention_loop_iteration_failed")
