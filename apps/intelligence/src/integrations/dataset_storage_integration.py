from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pyarrow import fs as arrow_filesystem

from src.configs.settings_config import IntelligenceSettings


@dataclass(frozen=True, slots=True)
class DatasetStorageLocation:
    filesystem: Any
    root_path: str

    def join(self, *relative_parts: str) -> str:
        return "/".join([self.root_path.rstrip("/"), *relative_parts])


def build_dataset_storage_location(settings: IntelligenceSettings) -> DatasetStorageLocation:
    if settings.uses_object_storage:
        bucket_and_prefix = settings.event_storage_uri.removeprefix("s3://").rstrip("/")
        object_storage_options: dict[str, Any] = {"region": settings.s3_region}
        if settings.s3_endpoint_url:
            scheme, _, endpoint_host = settings.s3_endpoint_url.partition("://")
            object_storage_options["endpoint_override"] = endpoint_host or scheme
            object_storage_options["scheme"] = scheme if endpoint_host else "https"
        access_key = settings.s3_access_key_id.get_secret_value()
        if access_key:
            object_storage_options["access_key"] = access_key
            object_storage_options["secret_key"] = settings.s3_secret_access_key.get_secret_value()
        return DatasetStorageLocation(arrow_filesystem.S3FileSystem(**object_storage_options), bucket_and_prefix)
    return build_local_dataset_storage_location(settings.event_storage_uri)


def build_local_dataset_storage_location(local_directory: str) -> DatasetStorageLocation:
    absolute_directory = Path(local_directory).expanduser().resolve()
    absolute_directory.mkdir(parents=True, exist_ok=True)
    return DatasetStorageLocation(arrow_filesystem.LocalFileSystem(), absolute_directory.as_posix())
