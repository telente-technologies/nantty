import asyncio
import hashlib
import json
import logging
from datetime import UTC, datetime
from typing import Literal

from pydantic import ValidationError

from src.modules.content_scoring.dtos.content_score_dto import ImageModerationRequest
from src.modules.content_scoring.services.image_moderation_interface_service import ImageModerationModelHolder
from src.modules.live_safety.dtos.live_safety_dto import (
    DetectedModerationLabel,
    LiveAudioSegmentJob,
    LiveFrameCapturedJob,
    LiveSafetyCategory,
    LiveSafetyScoreMessage,
)
from src.modules.live_safety.repositories.live_safety_score_queue_repository import LiveSafetyScorePublisher
from src.modules.live_safety.services.csam_hash_match_interface_service import CsamHashMatchProvider
from src.modules.live_safety.services.live_safety_label_mapping_service import (
    map_labels_to_categories,
    suggested_action_for_categories,
)
from src.modules.live_safety.services.transcribe_batch_transcription_service import SegmentTranscriber
from src.modules.live_safety.services.transcript_moderation_scorer_service import TranscriptModerationScorer

live_safety_logger = logging.getLogger("intelligence.live_safety")
LIVE_FRAME_JOB_TYPE = "liveFrame.captured"
LIVE_AUDIO_JOB_TYPE = "liveAudio.segmentCaptured"
MAXIMUM_SNIPPET_LENGTH = 1000
type JobOutcome = Literal["scored", "skipped", "rejected"]


def build_live_score_id(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:32]


class LiveSafetyScoringService:
    def __init__(
        self,
        image_models: ImageModerationModelHolder,
        transcript_scorer: TranscriptModerationScorer,
        transcriber: SegmentTranscriber,
        hash_matcher: CsamHashMatchProvider,
        publisher: LiveSafetyScorePublisher,
    ) -> None:
        self.image_models = image_models
        self.transcript_scorer = transcript_scorer
        self.transcriber = transcriber
        self.hash_matcher = hash_matcher
        self.publisher = publisher

    async def process_job_body(self, body: str, now: datetime | None = None) -> JobOutcome:
        try:
            job = json.loads(body)
            job_type, payload = job["type"], job["payload"]
            if job_type == LIVE_FRAME_JOB_TYPE:
                return await self.score_frame(LiveFrameCapturedJob.model_validate(payload), now)
            if job_type == LIVE_AUDIO_JOB_TYPE:
                return await self.score_audio_segment(LiveAudioSegmentJob.model_validate(payload), now)
        except ValueError, KeyError, TypeError, ValidationError:
            live_safety_logger.warning("live_safety_job_rejected")
            return "rejected"
        return "skipped"

    async def score_frame(self, job: LiveFrameCapturedJob, now: datetime | None = None) -> JobOutcome:
        generated_at = now or datetime.now(UTC)
        match = await asyncio.to_thread(self.hash_matcher.match_frame, job.bucket, job.frame_ref)
        if match is not None:
            await self.publisher.publish_live_safety_score(
                LiveSafetyScoreMessage(
                    score_id=build_live_score_id("frame", job.frame_id, "hash"),
                    live_id=job.live_id,
                    host_id=job.host_id,
                    kind="frame",
                    frame_ref=job.frame_ref,
                    captured_at=job.captured_at,
                    labels=[],
                    categories=[LiveSafetyCategory(category="child_safety", confidence=1.0)],
                    confidence=1.0,
                    suggested_action="hold",
                    model_version=f"hash-match-{self.hash_matcher.name}",
                    hash_match=True,
                    hash_match_provider=match.provider,
                    hash_match_reference=match.match_reference,
                    generated_at=generated_at,
                )
            )
            return "scored"
        labels, model_version = await asyncio.to_thread(self.detect_frame_labels, job)
        if labels is None:
            return "skipped"
        categories = map_labels_to_categories(labels)
        await self.publisher.publish_live_safety_score(
            LiveSafetyScoreMessage(
                score_id=build_live_score_id("frame", job.frame_id, model_version),
                live_id=job.live_id,
                host_id=job.host_id,
                kind="frame",
                frame_ref=job.frame_ref,
                captured_at=job.captured_at,
                labels=labels,
                categories=categories,
                confidence=categories[0].confidence if categories else 0.0,
                suggested_action=suggested_action_for_categories(categories),
                model_version=model_version,
                generated_at=generated_at,
            )
        )
        return "scored"

    def detect_frame_labels(self, job: LiveFrameCapturedJob) -> tuple[list[DetectedModerationLabel] | None, str]:
        model = self.image_models.active_model
        detector = getattr(model, "detect_frame_labels", None)
        if callable(detector):
            return detector(job.bucket, job.frame_ref), model.version
        scores = model.classify_image(
            ImageModerationRequest(
                media_id=job.frame_id,
                owner_id=job.host_id,
                purpose="live_frame",
                image_url=f"s3://{job.bucket}/{job.frame_ref}",
            )
        )
        if not scores:
            return None, model.version
        return [
            DetectedModerationLabel(name=name, confidence=min(max(score, 0.0), 1.0)) for name, score in scores.items()
        ], model.version

    async def score_audio_segment(self, job: LiveAudioSegmentJob, now: datetime | None = None) -> JobOutcome:
        transcript = await self.transcriber.transcribe_segment(job.segment_id, job.bucket, job.segment_ref)
        if not transcript.strip():
            return "skipped"
        generated_at = now or datetime.now(UTC)
        categories = await self.transcript_scorer.score_transcript(job.segment_id, transcript, generated_at)
        await self.publisher.publish_live_safety_score(
            LiveSafetyScoreMessage(
                score_id=build_live_score_id("transcript", job.segment_id, self.transcript_scorer.version),
                live_id=job.live_id,
                host_id=job.host_id,
                kind="transcript",
                frame_ref="",
                captured_at=job.captured_at,
                labels=[],
                categories=categories,
                confidence=categories[0].confidence if categories else 0.0,
                suggested_action=suggested_action_for_categories(categories),
                model_version=self.transcript_scorer.version,
                transcript_snippet=transcript[:MAXIMUM_SNIPPET_LENGTH],
                generated_at=generated_at,
            )
        )
        return "scored"
