from dataclasses import dataclass

from app.configs.settings_config import IntelligenceSettings
from app.registry.active_model_holder import ActiveModelHolder
from app.registry.model_registry import ModelRegistry
from app.services.account_and_clip_recommendation_service import AccountAndClipRecommendationService
from app.services.ad_selection_service import AdSelectionService
from app.services.clip_ranking_service import ClipRankingService
from app.services.event_ingestion_service import EventIngestionService
from app.services.experiment_service import ExperimentService
from app.services.feed_ranking_service import FeedRankingService
from app.services.product_recommendation_service import ProductRecommendationService
from app.services.risk_scoring_service import RiskScoringService
from app.services.search_reranking_service import SearchRerankingService
from app.services.trending_service import TrendingService
from app.stores.feature_backend_protocol import FeatureBackend
from app.stores.feature_log_sink import FeatureLogParquetSink
from app.stores.in_memory_feature_backend import InMemoryFeatureBackend
from app.stores.online_feature_keyspace import OnlineFeatureKeyspace
from app.stores.online_feature_store import OnlineFeatureStore
from app.stores.raw_event_sink import RawEventParquetSink
from app.stores.redis_feature_backend import RedisFeatureBackend
from app.stores.storage_filesystem import build_dataset_storage_location


@dataclass(frozen=True)
class ApplicationContainer:
    settings: IntelligenceSettings
    feature_backend: FeatureBackend
    feature_store: OnlineFeatureStore
    model_holder: ActiveModelHolder
    feature_log_sink: FeatureLogParquetSink
    event_ingestion_service: EventIngestionService
    feed_ranking_service: FeedRankingService
    clip_ranking_service: ClipRankingService
    ad_selection_service: AdSelectionService
    product_recommendation_service: ProductRecommendationService
    account_and_clip_recommendation_service: AccountAndClipRecommendationService
    trending_service: TrendingService
    search_reranking_service: SearchRerankingService
    risk_scoring_service: RiskScoringService
    experiment_service: ExperimentService


def build_feature_backend(settings: IntelligenceSettings) -> FeatureBackend:
    if settings.redis_url:
        return RedisFeatureBackend(settings.redis_url, settings.redis_socket_timeout_seconds)
    return InMemoryFeatureBackend()


def build_application_container(
    settings: IntelligenceSettings, feature_backend: FeatureBackend | None = None
) -> ApplicationContainer:
    backend = feature_backend or build_feature_backend(settings)
    feature_store = OnlineFeatureStore(backend, OnlineFeatureKeyspace(settings.redis_key_prefix))
    storage_location = build_dataset_storage_location(settings)
    model_holder = ActiveModelHolder(
        ModelRegistry(settings.model_registry_path, settings.model_signing_secret.get_secret_value())
    )
    feature_log_sink = FeatureLogParquetSink(storage_location, settings.feature_log_max_buffered_rows)
    clip_ranking_service = ClipRankingService(feature_store, model_holder, feature_log_sink)
    return ApplicationContainer(
        settings=settings,
        feature_backend=backend,
        feature_store=feature_store,
        model_holder=model_holder,
        feature_log_sink=feature_log_sink,
        event_ingestion_service=EventIngestionService(
            feature_store, RawEventParquetSink(storage_location), settings.event_deduplication_retention_seconds
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
    )
