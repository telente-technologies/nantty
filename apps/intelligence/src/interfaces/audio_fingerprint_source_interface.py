from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class ChromaprintFingerprint:
    media_id: str
    duration_seconds: float
    values: tuple[int, ...]


class AudioFingerprintSource(Protocol):
    @property
    def source_name(self) -> str: ...

    async def fetch_chromaprint(self, media_id: str) -> ChromaprintFingerprint | None: ...
