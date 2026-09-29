from datetime import UTC, datetime, timedelta

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


def list_partition_directories(location: DatasetStorageLocation, dataset_name: str) -> list[str]:
    selector = arrow_filesystem.FileSelector(location.join(dataset_name), recursive=True, allow_not_found=True)
    return sorted(
        info.path
        for info in location.filesystem.get_file_info(selector)
        if info.type == arrow_filesystem.FileType.Directory
        and info.base_name.count("=") == 1
        and "_date=" in info.base_name
    )


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
            partition_date = datetime.strptime(directory.rsplit("=", 1)[1], "%Y-%m-%d").replace(tzinfo=UTC).date()
            if today - partition_date < skip_partitions_newer_than:
                continue
            merged_file_count += compact_partition_directory(location, directory, schema)
        compacted[dataset_name] = merged_file_count
    return compacted
