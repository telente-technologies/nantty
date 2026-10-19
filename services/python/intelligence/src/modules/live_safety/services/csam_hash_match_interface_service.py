from typing import Protocol

from src.modules.child_safety.services.hash_match_provider_interface_service import (
    HashMatchProvider,
    ObjectBytesReader,
    match_stored_object,
)
from src.modules.live_safety.dtos.live_safety_dto import CsamHashMatch


class CsamHashMatchProvider(Protocol):
    name: str

    def match_frame(self, bucket: str, key: str) -> CsamHashMatch | None: ...


class DisabledCsamHashMatchProvider:
    name = "disabled"

    def match_frame(self, _bucket: str, _key: str) -> CsamHashMatch | None:
        return None


class CsamHashMatchingNotConfiguredError(RuntimeError):
    pass


class StoredFrameHashMatcher:
    def __init__(self, provider: HashMatchProvider, read_object: ObjectBytesReader | None) -> None:
        self.provider = provider
        self.read_object = read_object
        self.name = provider.name

    def match_frame(self, bucket: str, key: str) -> CsamHashMatch | None:
        match = match_stored_object(self.provider, self.read_object, bucket, key)
        if match is None:
            return None
        return CsamHashMatch(provider=match.provider, match_reference=match.reference)


def build_csam_hash_match_provider(
    enabled: bool, provider: CsamHashMatchProvider | None = None
) -> CsamHashMatchProvider:
    if not enabled:
        return DisabledCsamHashMatchProvider()
    if provider is None:
        raise CsamHashMatchingNotConfiguredError(
            "CSAM hash matching is enabled but no vetted hash-matching provider is wired in"
        )
    return provider


def build_live_frame_hash_matcher(
    provider: HashMatchProvider, read_object: ObjectBytesReader | None
) -> CsamHashMatchProvider:
    if not provider.enabled:
        return DisabledCsamHashMatchProvider()
    return StoredFrameHashMatcher(provider, read_object)
