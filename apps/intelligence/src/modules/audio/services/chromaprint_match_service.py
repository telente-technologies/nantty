from dataclasses import replace

from src.interfaces.audio_fingerprint_source_interface import AudioFingerprintSource, ChromaprintFingerprint
from src.modules.audio.dtos.copyright_audio_match_dto import (
    CopyrightAudioMatch,
    CopyrightAudioMatchRequest,
    CopyrightAudioMatchResponse,
)

CHROMAPRINT_ITEMS_PER_SECOND = 7.8125
MAXIMUM_OFFSET_ITEMS = 240
MINIMUM_OVERLAP_ITEMS = 16
BITS_PER_ITEM = 32
RANDOM_BIT_ERROR_RATE = 0.5


def count_differing_bits(first: int, second: int) -> int:
    return ((first ^ second) & 0xFFFFFFFF).bit_count()


def best_alignment(reference: tuple[int, ...], target: tuple[int, ...]) -> tuple[float, int, int]:
    best_score, best_offset, best_overlap = 0.0, 0, 0
    for offset in range(-min(MAXIMUM_OFFSET_ITEMS, len(target) - 1), min(MAXIMUM_OFFSET_ITEMS, len(reference) - 1) + 1):
        pairs = [
            (reference[index + offset], target[index])
            for index in range(len(target))
            if 0 <= index + offset < len(reference)
        ]
        if len(pairs) < MINIMUM_OVERLAP_ITEMS:
            continue
        bit_error_rate = sum(count_differing_bits(first, second) for first, second in pairs) / (
            len(pairs) * BITS_PER_ITEM
        )
        score = max(0.0, 1.0 - bit_error_rate / RANDOM_BIT_ERROR_RATE)
        if score > best_score:
            best_score, best_offset, best_overlap = score, offset, len(pairs)
    return best_score, best_offset, best_overlap


def compare_chromaprint_fingerprints(
    reference: ChromaprintFingerprint, target: ChromaprintFingerprint
) -> CopyrightAudioMatch:
    score, offset, overlap = best_alignment(reference.values, target.values)
    target_start = max(0, -offset) / CHROMAPRINT_ITEMS_PER_SECOND
    return CopyrightAudioMatch(
        target_media_id=target.media_id,
        reference_media_id=reference.media_id,
        confidence_percent=round(score * 100),
        target_start_seconds=round(target_start, 2),
        target_end_seconds=round(target_start + overlap / CHROMAPRINT_ITEMS_PER_SECOND, 2),
        reference_start_seconds=round(max(0, offset) / CHROMAPRINT_ITEMS_PER_SECOND, 2),
    )


class CopyrightAudioMatchService:
    def __init__(self, fingerprint_source: AudioFingerprintSource) -> None:
        self.fingerprint_source = fingerprint_source

    async def match(self, request: CopyrightAudioMatchRequest) -> CopyrightAudioMatchResponse:
        fetched_reference = await self.fingerprint_source.fetch_chromaprint(request.reference_media_id)
        if fetched_reference is None:
            return CopyrightAudioMatchResponse(
                claim_id=request.claim_id,
                fingerprint_source=self.fingerprint_source.source_name,
                available=False,
                matches=[],
            )
        reference = replace(fetched_reference, media_id=request.reference_media_id)
        matches: list[CopyrightAudioMatch] = []
        for target_media_id in request.target_media_ids:
            target = await self.fingerprint_source.fetch_chromaprint(target_media_id)
            if target is not None:
                matches.append(compare_chromaprint_fingerprints(reference, replace(target, media_id=target_media_id)))
        matches.sort(key=lambda match: match.confidence_percent, reverse=True)
        return CopyrightAudioMatchResponse(
            claim_id=request.claim_id,
            fingerprint_source=self.fingerprint_source.source_name,
            available=bool(matches),
            matches=matches,
        )
