from collections.abc import Sequence

import polars as pl
import pyarrow as arrow
import pyarrow.dataset as arrow_dataset
from pyarrow import fs as arrow_filesystem

from src.enums.ranking_surface_enum import RankingSurface
from src.integrations.dataset_storage_integration import DatasetStorageLocation
from src.modules.events_ingestion.repositories.raw_event_parquet_repository import (
    RAW_EVENT_ARROW_SCHEMA,
    RAW_EVENTS_DATASET_NAME,
)
from src.repositories.feature_log_parquet_repository import FEATURE_LOG_ARROW_SCHEMA, FEATURE_LOGS_DATASET_NAME


def directory_exists(location: DatasetStorageLocation, directory_path: str) -> bool:
    file_info = location.filesystem.get_file_info(directory_path)
    return bool(file_info.type == arrow_filesystem.FileType.Directory)


def read_parquet_directory(location: DatasetStorageLocation, directory_path: str, schema: arrow.Schema) -> arrow.Table:
    if not directory_exists(location, directory_path):
        return schema.empty_table()
    dataset = arrow_dataset.dataset(
        directory_path,
        filesystem=location.filesystem,
        format="parquet",
        partitioning=None,
        schema=schema,
        exclude_invalid_files=True,
    )
    return dataset.to_table()


def load_raw_events(location: DatasetStorageLocation, event_types: Sequence[str]) -> pl.DataFrame:
    tables = [
        read_parquet_directory(
            location, location.join(RAW_EVENTS_DATASET_NAME, f"event_type={event_type}"), RAW_EVENT_ARROW_SCHEMA
        )
        for event_type in event_types
    ]
    combined = (
        pl.from_arrow(arrow.concat_tables(tables)) if tables else pl.from_arrow(RAW_EVENT_ARROW_SCHEMA.empty_table())
    )
    assert isinstance(combined, pl.DataFrame)
    return combined.unique(subset=["event_id"], keep="first", maintain_order=True)


def load_feature_logs(
    location: DatasetStorageLocation, surface: RankingSurface, feature_schema_version: int
) -> pl.DataFrame:
    table = read_parquet_directory(
        location, location.join(FEATURE_LOGS_DATASET_NAME, f"surface={surface}"), FEATURE_LOG_ARROW_SCHEMA
    )
    frame = pl.from_arrow(table)
    assert isinstance(frame, pl.DataFrame)
    return frame.filter(pl.col("feature_schema_version") == feature_schema_version).with_row_index("row_id")


def extract_payload_text(json_path: str) -> pl.Expr:
    return pl.col("payload_json").str.json_path_match(json_path)


def extract_payload_number(json_path: str) -> pl.Expr:
    return pl.col("payload_json").str.json_path_match(json_path).cast(pl.Float64, strict=False)
