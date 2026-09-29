from fastapi import FastAPI

from src.container import ApplicationContainer
from src.controllers.health_controller import HealthController
from src.interfaces.intelligence_module_interface import IntelligenceModule
from src.modules.ads.ads_module import AdsModule
from src.modules.audio.audio_module import AudioModule
from src.modules.clips.clips_module import ClipsModule
from src.modules.events_ingestion.events_ingestion_module import EventsIngestionModule
from src.modules.experiments.experiments_module import ExperimentsModule
from src.modules.feed.feed_module import FeedModule
from src.modules.model_registry.model_registry_module import ModelRegistryModule
from src.modules.recommendations.recommendations_module import RecommendationsModule
from src.modules.risk.risk_module import RiskModule
from src.modules.search.search_module import SearchModule
from src.modules.social_proof.social_proof_module import SocialProofModule
from src.modules.trending.trending_module import TrendingModule
from src.routes.health_routes import build_health_router


def list_intelligence_modules() -> list[IntelligenceModule]:
    return [
        EventsIngestionModule(),
        FeedModule(),
        ClipsModule(),
        SocialProofModule(),
        RecommendationsModule(),
        AdsModule(),
        TrendingModule(),
        SearchModule(),
        RiskModule(),
        ExperimentsModule(),
        AudioModule(),
        ModelRegistryModule(),
    ]


def load_intelligence_modules(application: FastAPI, container: ApplicationContainer) -> None:
    application.include_router(build_health_router(HealthController(container.feature_backend)))
    for module in list_intelligence_modules():
        module.register_handlers(container)
        application.include_router(module.build_router(container))
