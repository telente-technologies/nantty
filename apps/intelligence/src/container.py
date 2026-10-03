from dataclasses import dataclass

from src.configs.settings_config import IntelligenceSettings
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.databases.redis_feature_database import RedisFeatureBackend
from src.integrations.dataset_storage_integration import build_dataset_storage_location
from src.integrations.rabbitmq_channel_integration import RabbitMqChannelProvider
from src.interfaces.feature_backend_interface import FeatureBackend
from src.modules.ad_click_prediction.services.ad_click_prediction_service import AdClickPredictionService
from src.modules.ads.services.ad_selection_service import AdSelectionService
from src.modules.audio.services.audio_fingerprint_index_service import AudioFingerprintIndexService
from src.modules.chat_spam.services.chat_spam_scoring_service import ChatSpamScoringService
from src.modules.clips.services.clip_ranking_service import ClipRankingService
from src.modules.creator_eligibility.services.real_followers_estimation_service import (
    RealFollowersEstimationService,
)
from src.modules.domain_events.repositories.sqs_domain_event_queue_repository import build_sqs_client
from src.modules.domain_events.services.domain_event_consumer_service import DomainEventConsumerService
from src.modules.domain_events.services.personal_data_purge_service import PersonalDataPurgeService
from src.modules.events_ingestion.repositories.raw_event_parquet_repository import RawEventParquetSink
from src.modules.events_ingestion.services.event_ingestion_service import EventIngestionService
from src.modules.experiments.services.experiment_service import ExperimentService
from src.modules.extended_risk.services.extended_risk_scoring_service import ExtendedRiskScoringService
from src.modules.feed.services.feed_ranking_service import FeedRankingService
from src.modules.model_registry.repositories.model_registry_repository import ModelRegistry
from src.modules.model_registry.services.active_model_holder_service import ActiveModelHolder
from src.modules.moderation.services.content_moderation_service import ContentModerationService
from src.modules.moderation.services.moderation_model_interface_service import ModerationModelHolder
from src.modules.recommendations.services.account_and_clip_recommendation_service import (
    AccountAndClipRecommendationService,
)
from src.modules.recommendations.services.product_recommendation_service import ProductRecommendationService
from src.modules.risk.services.risk_scoring_service import RiskScoringService
from src.modules.search.services.search_reranking_service import SearchRerankingService
from src.modules.social_proof.services.social_proof_service import SocialProofService
from src.modules.trending.services.trending_service import TrendingService
from src.modules.trust_advisory.repositories.trust_advisory_queue_repository import (
    AmqpTrustAdvisoryPublisher,
    NullTrustAdvisoryPublisher,
    SqsTrustAdvisoryPublisher,
    TrustAdvisoryPublisher,
)
from src.modules.trust_advisory.services.suspension_suggestion_service import SuspensionSuggestionService
from src.repositories.feature_log_parquet_repository import FeatureLogParquetSink
from src.repositories.online_feature_keyspace_repository import OnlineFeatureKeyspace
from src.repositories.online_feature_repository import OnlineFeatureStore
from src.utils.cqrs_util import CommandBus, QueryBus


@dataclass(frozen=True)
class ApplicationContainer:
    settings: IntelligenceSettings
    feature_backend: FeatureBackend
    feature_store: OnlineFeatureStore
    model_holder: ActiveModelHolder
    feature_log_sink: FeatureLogParquetSink
    event_ingestion_service: EventIngestionService
    domain_event_consumer_service: DomainEventConsumerService
    feed_ranking_service: FeedRankingService
    clip_ranking_service: ClipRankingService
    ad_selection_service: AdSelectionService
    product_recommendation_service: ProductRecommendationService
    account_and_clip_recommendation_service: AccountAndClipRecommendationService
    trending_service: TrendingService
    search_reranking_service: SearchRerankingService
    risk_scoring_service: RiskScoringService
    experiment_service: ExperimentService
    suspension_suggestion_service: SuspensionSuggestionService
    chat_spam_scoring_service: ChatSpamScoringService
    moderation_model_holder: ModerationModelHolder
    content_moderation_service: ContentModerationService
    real_followers_estimation_service: RealFollowersEstimationService
    extended_risk_scoring_service: ExtendedRiskScoringService
    ad_click_prediction_service: AdClickPredictionService
    social_proof_service: SocialProofService
    audio_fingerprint_index_service: AudioFingerprintIndexService
    command_bus: CommandBus
    query_bus: QueryBus
    rabbitmq_channels: RabbitMqChannelProvider | None = None


def build_feature_backend(settings: IntelligenceSettings) -> FeatureBackend:
    if settings.redis_url:
        return RedisFeatureBackend(settings.redis_url, settings.redis_socket_timeout_seconds)
    return InMemoryFeatureBackend()


def build_trust_advisory_publisher(
    settings: IntelligenceSettings, channels: RabbitMqChannelProvider | None
) -> TrustAdvisoryPublisher:
    if settings.event_bus == "rabbitmq" and channels is not None:
        return AmqpTrustAdvisoryPublisher(channels, settings.trust_advisory_queue)
    if settings.event_bus == "sqs" and settings.trust_advisory_queue_url:
        return SqsTrustAdvisoryPublisher(build_sqs_client(settings), settings.trust_advisory_queue_url)
    return NullTrustAdvisoryPublisher()


def build_application_container(
    settings: IntelligenceSettings, feature_backend: FeatureBackend | None = None
) -> ApplicationContainer:
    backend = feature_backend or build_feature_backend(settings)
    rabbitmq_url = settings.rabbitmq_url.get_secret_value()
    rabbitmq_channels = RabbitMqChannelProvider(rabbitmq_url) if rabbitmq_url else None
    feature_store = OnlineFeatureStore(backend, OnlineFeatureKeyspace(settings.redis_key_prefix))
    storage_location = build_dataset_storage_location(settings)
    model_holder = ActiveModelHolder(
        ModelRegistry(settings.model_registry_path, settings.model_signing_secret.get_secret_value())
    )
    feature_log_sink = FeatureLogParquetSink(storage_location, settings.feature_log_max_buffered_rows)
    clip_ranking_service = ClipRankingService(feature_store, model_holder, feature_log_sink)
    event_ingestion_service = EventIngestionService(
        feature_store, RawEventParquetSink(storage_location), settings.event_deduplication_retention_seconds
    )
    suggestion_service = SuspensionSuggestionService(
        build_trust_advisory_publisher(settings, rabbitmq_channels), backend, feature_store.keyspace
    )
    moderation_model_holder = ModerationModelHolder()
    return ApplicationContainer(
        settings=settings,
        feature_backend=backend,
        feature_store=feature_store,
        model_holder=model_holder,
        feature_log_sink=feature_log_sink,
        event_ingestion_service=event_ingestion_service,
        domain_event_consumer_service=DomainEventConsumerService(
            feature_store, event_ingestion_service, PersonalDataPurgeService(backend, feature_store.keyspace)
        ),
        feed_ranking_service=FeedRankingService(feature_store, model_holder, feature_log_sink),
        clip_ranking_service=clip_ranking_service,
        ad_selection_service=AdSelectionService(feature_store, model_holder, feature_log_sink),
        product_recommendation_service=ProductRecommendationService(feature_store, model_holder),
        account_and_clip_recommendation_service=AccountAndClipRecommendationService(
            feature_store, clip_ranking_service
        ),
        trending_service=TrendingService(feature_store),
        search_reranking_service=SearchRerankingService(feature_store),
        risk_scoring_service=RiskScoringService(feature_store, model_holder, feature_log_sink),
        experiment_service=ExperimentService(feature_store),
        suspension_suggestion_service=suggestion_service,
        chat_spam_scoring_service=ChatSpamScoringService(feature_store, suggestion_service),
        moderation_model_holder=moderation_model_holder,
        content_moderation_service=ContentModerationService(moderation_model_holder),
        real_followers_estimation_service=RealFollowersEstimationService(),
        extended_risk_scoring_service=ExtendedRiskScoringService(suggestion_service),
        ad_click_prediction_service=AdClickPredictionService(feature_store, model_holder),
        social_proof_service=SocialProofService(feature_store),
        audio_fingerprint_index_service=AudioFingerprintIndexService(feature_store),
        command_bus=CommandBus(),
        query_bus=QueryBus(),
        rabbitmq_channels=rabbitmq_channels if settings.event_bus == "rabbitmq" else None,
    )
