import asyncio
import logging
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime

import pyarrow as arrow

from src.integrations.dataset_storage_integration import DatasetStorageLocation
from src.utils.parquet_storage_util import write_parquet_table_atomically

FEATURE_LOGS_DATASET_NAME = "feature_logs"
feature_log_logger = logging.getLogger("intelligence.feature_logs")

FEATURE_LOG_ARROW_SCHEMA = arrow.schema(
    [
        ("request_id", arrow.string()),
        ("surface", arrow.string()),
        ("actor_id", arrow.string()),
        ("item_id", arrow.string()),
        ("logged_at", arrow.timestamp("us", tz="UTC")),
        ("served_position", arrow.int32()),
        ("model_version", arrow.string()),
        ("feature_schema_version", arrow.int16()),
        ("features", arrow.list_(arrow.float32())),
    ]
)


@dataclass(frozen=True, slots=True)
class LoggedFeatureRow:
    request_id: str
    surface: str
    actor_id: str
    item_id: str
    logged_at: datetime
    served_position: int
    model_version: str | None
    feature_schema_version: int
    features: Sequence[float]


class FeatureLogParquetSink:
    def __init__(self, storage_location: DatasetStorageLocation, maximum_buffered_rows: int) -> None:
        self.storage_location = storage_location
        self.maximum_buffered_rows = maximum_buffered_rows
        self._buffered_rows: list[LoggedFeatureRow] = []
        self.dropped_row_count = 0

    def append_feature_rows(self, rows: Sequence[LoggedFeatureRow]) -> None:
        available_capacity = self.maximum_buffered_rows - len(self._buffered_rows)
        if available_capacity <= 0:
            self.dropped_row_count += len(rows)
            return
        self._buffered_rows.extend(rows[:available_capacity])
        self.dropped_row_count += max(len(rows) - available_capacity, 0)

    def take_buffered_rows(self) -> list[LoggedFeatureRow]:
        rows, self._buffered_rows = self._buffered_rows, []
        return rows

    def write_rows_synchronously(self, rows: Sequence[LoggedFeatureRow]) -> int:
        rows_by_partition: dict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)
        for row in rows:
            log_date = row.logged_at.astimezone(UTC).strftime("%Y-%m-%d")
            rows_by_partition[(row.surface, log_date)].append(
                {
                    "request_id": row.request_id,
                    "surface": row.surface,
                    "actor_id": row.actor_id,
                    "item_id": row.item_id,
                    "logged_at": row.logged_at.astimezone(UTC),
                    "served_position": row.served_position,
                    "model_version": row.model_version,
                    "feature_schema_version": row.feature_schema_version,
                    "features": [float(value) for value in row.features],
                }
            )
        for (surface, log_date), partition_rows in rows_by_partition.items():
            partition_directory = self.storage_location.join(
                FEATURE_LOGS_DATASET_NAME, f"surface={surface}", f"log_date={log_date}"
            )
            self.storage_location.filesystem.create_dir(partition_directory, recursive=True)
            table = arrow.Table.from_pylist(partition_rows, schema=FEATURE_LOG_ARROW_SCHEMA)
            write_parquet_table_atomically(self.storage_location, table, partition_directory)
        return len(rows)

    async def flush_buffered_rows(self) -> int:
        rows = self.take_buffered_rows()
        if not rows:
            return 0
        try:
            return await asyncio.to_thread(self.write_rows_synchronously, rows)
        except OSError:
            feature_log_logger.exception("feature_log_flush_failed", extra={"row_count": len(rows)})
            return 0

    async def run_periodic_flush_loop(self, flush_interval_seconds: float) -> None:
        while True:
            await asyncio.sleep(flush_interval_seconds)
            await self.flush_buffered_rows()
