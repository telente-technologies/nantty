import numpy as np
import pytest

from src.interfaces.audio_fingerprint_source_interface import ChromaprintFingerprint
from src.modules.audio.dtos.copyright_audio_match_dto import CopyrightAudioMatchRequest
from src.modules.audio.services.chromaprint_match_service import (
    CopyrightAudioMatchService,
    compare_chromaprint_fingerprints,
)
from tests.conftest import SignedIntelligenceClient


def random_fingerprint(media_id: str, seed: int, length: int = 400) -> ChromaprintFingerprint:
    values = np.random.default_rng(seed).integers(-(2**31), 2**31 - 1, size=length)
    return ChromaprintFingerprint(
        media_id=media_id, duration_seconds=length / 7.8125, values=tuple(int(value) for value in values)
    )


def flip_some_bits(fingerprint: ChromaprintFingerprint, media_id: str, bits_per_item: int) -> ChromaprintFingerprint:
    random_generator = np.random.default_rng(99)
    noisy = []
    for value in fingerprint.values:
        mask = 0
        for bit in random_generator.choice(32, size=bits_per_item, replace=False):
            mask |= 1 << int(bit)
        noisy.append(value ^ mask)
    return ChromaprintFingerprint(media_id=media_id, duration_seconds=fingerprint.duration_seconds, values=tuple(noisy))


class FakeFingerprintSource:
    source_name = "chromaprint"

    def __init__(self, fingerprints: dict[str, ChromaprintFingerprint]) -> None:
        self.fingerprints = fingerprints

    async def fetch_chromaprint(self, media_id: str) -> ChromaprintFingerprint | None:
        return self.fingerprints.get(media_id)


def test_identical_audio_scores_one_hundred_and_unrelated_audio_scores_low() -> None:
    original = random_fingerprint("original", 1)
    assert compare_chromaprint_fingerprints(original, original).confidence_percent == 100
    assert compare_chromaprint_fingerprints(original, random_fingerprint("other", 2)).confidence_percent < 20


def test_an_excerpt_used_later_in_a_clip_is_found_with_its_position() -> None:
    original = random_fingerprint("original", 3)
    excerpt = ChromaprintFingerprint(media_id="clip", duration_seconds=20, values=original.values[78:234])
    match = compare_chromaprint_fingerprints(original, excerpt)
    assert match.confidence_percent == 100
    assert match.reference_start_seconds == pytest.approx(78 / 7.8125, abs=0.01)


def test_a_re_encoded_copy_still_matches_strongly() -> None:
    original = random_fingerprint("original", 4)
    assert compare_chromaprint_fingerprints(original, flip_some_bits(original, "copy", 4)).confidence_percent >= 70


async def test_service_ranks_matches_and_reports_unavailable_fingerprints() -> None:
    original = random_fingerprint("ref", 5)
    service = CopyrightAudioMatchService(
        FakeFingerprintSource({"ref": original, "copy": original, "other": random_fingerprint("other", 6)})
    )
    response = await service.match(
        CopyrightAudioMatchRequest(
            claim_id="c1", reference_media_id="ref", target_media_ids=["other", "copy", "missing"]
        )
    )
    assert response.advisory is True
    assert response.available is True
    assert [match.target_media_id for match in response.matches] == ["copy", "other"]
    unavailable = await service.match(
        CopyrightAudioMatchRequest(claim_id="c1", reference_media_id="unknown", target_media_ids=["copy"])
    )
    assert unavailable.available is False
    assert unavailable.matches == []


async def test_endpoint_answers_with_a_placeholder_when_media_is_not_configured(
    signed_client: SignedIntelligenceClient,
) -> None:
    response = await signed_client.post(
        "/v1/audio/copyright-matches", {"claimId": "c1", "referenceMediaId": "ref", "targetMediaIds": ["clip-1"]}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["advisory"] is True
    assert body["available"] is False
    assert body["fingerprintSource"] == "placeholder"
