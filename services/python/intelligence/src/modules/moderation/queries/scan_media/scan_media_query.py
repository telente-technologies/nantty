from dataclasses import dataclass
from typing import ClassVar

from src.interfaces.cqrs_interface import Query
from src.modules.child_safety.dtos.child_safety_dto import MediaScanRequest


@dataclass(frozen=True, slots=True)
class ScanMediaQuery(Query):
    query_type: ClassVar[str] = "moderation.scanMedia"
    request: MediaScanRequest
