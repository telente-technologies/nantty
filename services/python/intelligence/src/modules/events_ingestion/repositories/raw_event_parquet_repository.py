import asyncio
import json
from collections import defaultdict
from collections.abc import Sequence
from datetime import UTC, datetime

import pyarrow as arrow

from src.events.event_envelope_dto import IntelligenceEvent
from src.integrations.dataset_storage_integration import DatasetStorageLocation
from src.utils.parquet_storage_util import write_parquet_table_atomically

RAW_EVENTS_DATASET_NAME = "raw_events"

RAW_EVENT_ARROW_SCHEMA = arrow.schema(
    [
        ("event_id", arrow.string()),
        ("event_type", arrow.string()),
        ("event_version", arrow.int16()),
        ("occurred_at", arrow.timestamp("us", tz="UTC")),
        ("received_at", arrow.timestamp("us", tz="UTC")),
        ("producer", arrow.string()),
        ("actor_id", arrow.string()),
        ("country", arrow.string()),
        ("region", arrow.string()),
        ("context_json", arrow.string()),
        ("payload_json", arrow.string()),
    ]
)


def convert_event_to_raw_row(event: IntelligenceEvent, received_at: datetime) -> dict[str, object]:
    return {
        "event_id": event.event_id,
        "event_type": event.event_type,
        "event_version": event.event_version,
        "occurred_at": event.occurred_at.astimezone(UTC),
        "received_at": received_at,
        "producer": event.producer,
        "actor_id": event.actor_id,
        "country": event.country,
        "region": event.region,
        "context_json": json.dumps(event.context.model_dump(mode="json", by_alias=True), separators=(",", ":")),
        "payload_json": json.dumps(event.payload.model_dump(mode="json", by_alias=True), separators=(",", ":")),
    }


class RawEventParquetSink:
    def __init__(self, storage_location: DatasetStorageLocation) -> None:
        self.storage_location = storage_location

    def write_events_synchronously(self, events: Sequence[IntelligenceEvent], received_at: datetime) -> int:
        rows_by_partition: dict[tuple[str, str], list[dict[str, object]]] = defaultdict(list)
        for event in events:
            event_date = event.occurred_at.astimezone(UTC).strftime("%Y-%m-%d")
            rows_by_partition[(event.event_type, event_date)].append(convert_event_to_raw_row(event, received_at))
        for (event_type, event_date), rows in rows_by_partition.items():
            partition_directory = self.storage_location.join(
                RAW_EVENTS_DATASET_NAME, f"event_type={event_type}", f"event_date={event_date}"
            )
            self.storage_location.filesystem.create_dir(partition_directory, recursive=True)
            table = arrow.Table.from_pylist(rows, schema=RAW_EVENT_ARROW_SCHEMA)
            write_parquet_table_atomically(self.storage_location, table, partition_directory)
        return len(events)

    async def write_events(self, events: Sequence[IntelligenceEvent], received_at: datetime) -> int:
        if not events:
            return 0
        return await asyncio.to_thread(self.write_events_synchronously, events, received_at)
