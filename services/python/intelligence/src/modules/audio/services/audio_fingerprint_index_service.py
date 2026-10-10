import asyncio
import contextlib
from collections import Counter, defaultdict
from datetime import UTC, datetime

from src.interfaces.feature_backend_interface import (
    FeatureWriteOperation,
    HashFieldAssign,
    HashFieldIncrement,
    SortedSetAssignScore,
    SortedSetKeepHighestScores,
)
from src.modules.audio.dtos.audio_fingerprint_dto import (
    MINIMUM_EXCERPT_SECONDS,
    AudioFingerprintRegistrationRequest,
    AudioFingerprintRegistrationResponse,
    AudioMatch,
    AudioMatchRequest,
    AudioMatchResponse,
    AudioSoundStatusResponse,
    AudioSoundStatusUpdateRequest,
)
from src.modules.audio.services.audio_landmark_fingerprint_service import (
    FINGERPRINT_ALGORITHM_VERSION,
    SECONDS_PER_FRAME,
    AudioFingerprint,
    compute_audio_fingerprint,
)
from src.repositories.online_feature_repository import OnlineFeatureStore

MAXIMUM_SOUNDS_PER_LANDMARK = 400
MINIMUM_ALIGNED_LANDMARKS = 8
EXCERPT_CLAIM_RETENTION_SECONDS = 10 * 60


class AudioSoundAlreadyRegisteredError(ValueError):
    pass


class AudioSoundNotFoundError(LookupError):
    pass


def score_offset_alignment(
    offset_counts_by_sound: dict[str, Counter[int]],
) -> list[tuple[str, int, int]]:
    best_alignment_by_sound: list[tuple[str, int, int]] = []
    for sound_id, offset_counts in offset_counts_by_sound.items():
        best_offset, best_count = 0, 0
        for offset in offset_counts:
            neighbourhood_count = offset_counts[offset - 1] + offset_counts[offset] + offset_counts[offset + 1]
            if neighbourhood_count > best_count or (neighbourhood_count == best_count and offset < best_offset):
                best_offset, best_count = offset, neighbourhood_count
        best_alignment_by_sound.append((sound_id, best_offset, best_count))
    return sorted(best_alignment_by_sound, key=lambda alignment: (-alignment[2], alignment[0]))


class AudioFingerprintIndexService:
    def __init__(self, feature_store: OnlineFeatureStore) -> None:
        self.feature_store = feature_store
        self.keyspace = feature_store.keyspace
        self.backend = feature_store.feature_backend

    async def read_sound_metadata(self, sound_ids: list[str]) -> dict[str, dict[str, float]]:
        rows = await self.backend.read_hash_fields(
            [self.keyspace.audio_sound_metadata_key(sound) for sound in sound_ids]
        )
        return dict(zip(sound_ids, rows, strict=True))

    async def match_fingerprint(
        self, fingerprint: AudioFingerprint, excluded_sound_ids: set[str], minimum_confidence: float, limit: int
    ) -> AudioMatchResponse:
        query_frames_by_hash: dict[int, list[int]] = defaultdict(list)
        for landmark in fingerprint.landmarks:
            query_frames_by_hash[landmark.landmark_hash].append(landmark.anchor_frame)
        landmark_hashes = list(query_frames_by_hash)
        stored_rows = await self.backend.read_sorted_set_highest_members(
            [self.keyspace.audio_landmark_key(landmark_hash) for landmark_hash in landmark_hashes],
            MAXIMUM_SOUNDS_PER_LANDMARK,
        )
        offset_counts_by_sound: dict[str, Counter[int]] = defaultdict(Counter)
        for landmark_hash, rows in zip(landmark_hashes, stored_rows, strict=True):
            for member, _score in rows:
                sound_id, _separator, stored_frame_text = member.rpartition("|")
                if sound_id in excluded_sound_ids or not stored_frame_text.isdigit():
                    continue
                for query_frame in query_frames_by_hash[landmark_hash]:
                    offset_counts_by_sound[sound_id][int(stored_frame_text) - query_frame] += 1
        query_landmark_count = max(len(fingerprint.landmarks), 1)
        qualifying = [
            alignment
            for alignment in score_offset_alignment(offset_counts_by_sound)
            if alignment[2] >= MINIMUM_ALIGNED_LANDMARKS and alignment[2] / query_landmark_count >= minimum_confidence
        ][:limit]
        metadata_by_sound = await self.read_sound_metadata([sound_id for sound_id, _offset, _count in qualifying])
        matches = [
            AudioMatch(
                sound_id=sound_id,
                confidence=round(min(aligned_count / query_landmark_count, 1.0), 4),
                aligned_landmark_count=aligned_count,
                matched_position_seconds=round(max(offset, 0) * SECONDS_PER_FRAME, 3),
                registered_at=(
                    datetime.fromtimestamp(metadata_by_sound[sound_id]["registered_at"], UTC)
                    if "registered_at" in metadata_by_sound[sound_id]
                    else None
                ),
                is_verified_original=metadata_by_sound[sound_id].get("is_verified_original", 0.0) == 1.0,
                is_flagged_copyright=metadata_by_sound[sound_id].get("is_flagged_copyright", 0.0) == 1.0,
            )
            for sound_id, offset, aligned_count in qualifying
        ]
        verified = [match for match in matches if match.is_verified_original and match.registered_at is not None]
        earliest_verified = min(verified, key=lambda match: (match.registered_at, match.sound_id)) if verified else None
        return AudioMatchResponse(
            matches=matches,
            query_landmark_count=len(fingerprint.landmarks),
            earliest_verified_sound_id=earliest_verified.sound_id if earliest_verified else None,
            any_flagged_match=any(match.is_flagged_copyright for match in matches),
            algorithm_version=FINGERPRINT_ALGORITHM_VERSION,
        )

    async def match_audio(self, request: AudioMatchRequest) -> AudioMatchResponse:
        fingerprint = await asyncio.to_thread(
            compute_audio_fingerprint, request.audio.decode_pcm_bytes(), MINIMUM_EXCERPT_SECONDS
        )
        return await self.match_fingerprint(
            fingerprint, set(request.excluded_sound_ids), request.minimum_confidence, request.limit
        )

    async def register_sound(
        self, request: AudioFingerprintRegistrationRequest
    ) -> AudioFingerprintRegistrationResponse:
        excerpt_claim_key = self.keyspace.audio_excerpt_claim_key(
            request.sound_id, round(request.excerpt_start_seconds)
        )
        claimed = await self.backend.claim_keys_if_absent([excerpt_claim_key], EXCERPT_CLAIM_RETENTION_SECONDS)
        if not claimed[0]:
            raise AudioSoundAlreadyRegisteredError(request.sound_id)
        try:
            fingerprint = await asyncio.to_thread(
                compute_audio_fingerprint, request.audio.decode_pcm_bytes(), MINIMUM_EXCERPT_SECONDS
            )
            existing_metadata = (await self.read_sound_metadata([request.sound_id]))[request.sound_id]
            prior_matches = await self.match_fingerprint(fingerprint, {request.sound_id}, 0.05, 10)
            frame_shift = round(request.excerpt_start_seconds / SECONDS_PER_FRAME)
            ownership_priority = -request.registered_at.timestamp()
            operations: list[FeatureWriteOperation] = []
            for landmark in fingerprint.landmarks:
                landmark_key = self.keyspace.audio_landmark_key(landmark.landmark_hash)
                member = f"{request.sound_id}|{landmark.anchor_frame + frame_shift}"
                operations += [
                    SortedSetAssignScore(landmark_key, member, ownership_priority),
                    SortedSetKeepHighestScores(landmark_key, MAXIMUM_SOUNDS_PER_LANDMARK),
                ]
            metadata_key = self.keyspace.audio_sound_metadata_key(request.sound_id)
            if not existing_metadata:
                operations += [
                    HashFieldAssign(metadata_key, "registered_at", request.registered_at.timestamp()),
                    HashFieldAssign(metadata_key, "is_verified_original", 1.0 if request.is_verified_original else 0.0),
                    HashFieldAssign(metadata_key, "is_flagged_copyright", 0.0),
                ]
            operations += [
                HashFieldIncrement(metadata_key, "landmark_count", float(len(fingerprint.landmarks))),
                HashFieldIncrement(metadata_key, "fingerprinted_seconds", fingerprint.duration_seconds),
            ]
            await self.backend.apply_write_operations(operations)
        except BaseException:
            with contextlib.suppress(Exception):
                await self.backend.delete_keys([excerpt_claim_key])
            raise
        return AudioFingerprintRegistrationResponse(
            sound_id=request.sound_id,
            landmark_count=len(fingerprint.landmarks),
            duration_seconds=fingerprint.duration_seconds,
            matches_before_registration=prior_matches,
        )

    async def update_sound_status(self, request: AudioSoundStatusUpdateRequest) -> AudioSoundStatusResponse:
        metadata = (await self.read_sound_metadata([request.sound_id]))[request.sound_id]
        if not metadata:
            raise AudioSoundNotFoundError(request.sound_id)
        metadata_key = self.keyspace.audio_sound_metadata_key(request.sound_id)
        operations: list[FeatureWriteOperation] = []
        if request.is_verified_original is not None:
            metadata["is_verified_original"] = 1.0 if request.is_verified_original else 0.0
            operations.append(HashFieldAssign(metadata_key, "is_verified_original", metadata["is_verified_original"]))
        if request.is_flagged_copyright is not None:
            metadata["is_flagged_copyright"] = 1.0 if request.is_flagged_copyright else 0.0
            operations.append(HashFieldAssign(metadata_key, "is_flagged_copyright", metadata["is_flagged_copyright"]))
        await self.backend.apply_write_operations(operations)
        return AudioSoundStatusResponse(
            sound_id=request.sound_id,
            is_verified_original=metadata.get("is_verified_original", 0.0) == 1.0,
            is_flagged_copyright=metadata.get("is_flagged_copyright", 0.0) == 1.0,
        )
