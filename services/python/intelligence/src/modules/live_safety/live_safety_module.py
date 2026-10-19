import asyncio
import logging
from collections.abc import Callable
from typing import Any

import boto3

from src.configs.settings_config import IntelligenceSettings
from src.integrations.aws_client_config import AWS_CLIENT_CONFIG
from src.integrations.rabbitmq_channel_integration import RabbitMqChannelProvider
from src.modules.content_scoring.services.image_moderation_interface_service import ImageModerationModelHolder
from src.modules.live_safety.repositories.amqp_live_safety_job_queue_repository import AmqpLiveSafetyJobQueueConsumer
from src.modules.live_safety.repositories.live_safety_score_queue_repository import (
    AmqpLiveSafetyScorePublisher,
    LiveSafetyScorePublisher,
    NullLiveSafetyScorePublisher,
)
from src.modules.child_safety.services.hash_match_provider_interface_service import (
    DisabledHashMatchProvider,
    HashMatchProvider,
    ObjectBytesReader,
)
from src.modules.live_safety.services.csam_hash_match_interface_service import build_live_frame_hash_matcher
from src.modules.live_safety.services.live_safety_scoring_service import LiveSafetyScoringService
from src.modules.live_safety.services.rekognition_image_moderation_model_service import (
    RekognitionImageModerationModel,
    aws_credentials_available,
)
from src.modules.live_safety.services.transcribe_batch_transcription_service import (
    DisabledSegmentTranscriber,
    SegmentTranscriber,
    TranscribeBatchTranscriber,
)
from src.modules.live_safety.services.transcript_moderation_scorer_service import TranscriptModerationScorer
from src.modules.moderation.services.content_moderation_service import ContentModerationService

live_safety_module_logger = logging.getLogger("intelligence.live_safety")
type AwsSessionFactory = Callable[[str], Any]


def default_aws_session_factory(region: str) -> Any:
    return boto3.session.Session(region_name=region)


def should_use_rekognition(settings: IntelligenceSettings, session: Any | None) -> bool:
    if settings.live_safety_rekognition == "disabled" or settings.environment == "test":
        return False
    if settings.live_safety_rekognition == "enabled":
        return True
    return session is not None and aws_credentials_available(session)


def register_rekognition_when_available(
    settings: IntelligenceSettings,
    image_models: ImageModerationModelHolder,
    session_factory: AwsSessionFactory | None = None,
) -> Any | None:
    if settings.live_safety_rekognition == "disabled" or settings.environment == "test":
        return None
    session = (session_factory or default_aws_session_factory)(settings.live_safety_aws_region)
    if not should_use_rekognition(settings, session):
        live_safety_module_logger.info("rekognition_disabled_no_aws_credentials")
        return None
    image_models.register_model(
        RekognitionImageModerationModel(
            session.client("rekognition", config=AWS_CLIENT_CONFIG),
            settings.live_safety_rekognition_min_confidence,
            frozenset({settings.media_bucket}) if settings.media_bucket else frozenset(),
        )
    )
    return session


def build_segment_transcriber(settings: IntelligenceSettings, session: Any | None) -> SegmentTranscriber:
    if (
        not settings.live_safety_transcribe_enabled
        or session is None
        or not settings.live_safety_transcribe_output_bucket
    ):
        return DisabledSegmentTranscriber()
    return TranscribeBatchTranscriber(
        session.client("transcribe", config=AWS_CLIENT_CONFIG),
        session.client("s3", config=AWS_CLIENT_CONFIG),
        settings.live_safety_transcribe_output_bucket,
        language_code=settings.live_safety_transcribe_language_code,
    )


def build_live_safety_publisher(
    settings: IntelligenceSettings, channels: RabbitMqChannelProvider | None
) -> LiveSafetyScorePublisher:
    if settings.event_bus == "rabbitmq" and channels is not None:
        return AmqpLiveSafetyScorePublisher(channels, settings.trust_live_safety_queue)
    logging.getLogger("intelligence.live_safety").error(
        "null_live_safety_score_publisher",
        extra={"event_bus": settings.event_bus, "reason": "no_usable_message_bus"},
    )
    return NullLiveSafetyScorePublisher()


def build_live_safety_scoring_service(
    settings: IntelligenceSettings,
    channels: RabbitMqChannelProvider | None,
    image_models: ImageModerationModelHolder,
    text_moderation: ContentModerationService,
    session_factory: AwsSessionFactory | None = None,
    hash_provider: HashMatchProvider | None = None,
) -> LiveSafetyScoringService:
    session = register_rekognition_when_available(settings, image_models, session_factory)
    return LiveSafetyScoringService(
        image_models,
        TranscriptModerationScorer(text_moderation),
        build_segment_transcriber(settings, session),
        build_live_frame_hash_matcher(hash_provider or DisabledHashMatchProvider(), build_frame_object_reader(session)),
        build_live_safety_publisher(settings, channels),
        settings.child_safety_explicit_confidence,
        settings.child_safety_minor_age_ceiling,
    )


MAXIMUM_FRAME_BYTES = 8 * 1024 * 1024


def build_frame_object_reader(session: Any | None) -> ObjectBytesReader | None:
    if session is None:
        return None
    client = session.client("s3", config=AWS_CLIENT_CONFIG)

    def read_frame_bytes(bucket: str, key: str) -> bytes:
        body: bytes = client.get_object(Bucket=bucket, Key=key)["Body"].read(MAXIMUM_FRAME_BYTES)
        return body

    return read_frame_bytes


def start_live_safety_consumers(
    settings: IntelligenceSettings, channels: RabbitMqChannelProvider | None, scoring: LiveSafetyScoringService
) -> list[asyncio.Task[None]]:
    if channels is None:
        return []
    queues = [settings.live_safety_frames_queue] + (
        [settings.live_safety_audio_queue] if settings.live_safety_transcribe_enabled else []
    )
    return [
        asyncio.create_task(
            AmqpLiveSafetyJobQueueConsumer(channels, queue, scoring, settings.live_safety_prefetch).run_consume_loop(),
            name=f"live_safety:{queue}",
        )
        for queue in queues
    ]
