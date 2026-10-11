import uuid

import pyarrow as arrow
import pyarrow.parquet as arrow_parquet

from src.integrations.dataset_storage_integration import DatasetStorageLocation


def new_parquet_part_file_name() -> str:
    return f"part-{uuid.uuid4().hex}.parquet"


def write_parquet_table_atomically(
    storage_location: DatasetStorageLocation,
    table: arrow.Table,
    partition_directory: str,
    file_name: str | None = None,
) -> str:
    file_name = file_name or new_parquet_part_file_name()
    in_progress_path = f"{partition_directory}/.inprogress-{file_name}"
    final_path = f"{partition_directory}/{file_name}"
    arrow_parquet.write_table(table, in_progress_path, filesystem=storage_location.filesystem, compression="zstd")
    storage_location.filesystem.move(in_progress_path, final_path)
    return final_path
