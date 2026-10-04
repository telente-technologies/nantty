from typing import Protocol

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
