from fastapi import FastAPI

from src.container import ApplicationContainer
from src.controllers.health_controller import HealthController
from src.interfaces.intelligence_module_interface import IntelligenceModule
from src.modules.ad_click_prediction.ad_click_prediction_module import AdClickPredictionModule
from src.modules.ads.ads_module import AdsModule
from src.modules.audio.audio_module import AudioModule
from src.modules.bot_detection.bot_detection_module import BotDetectionModule
from src.modules.chat_spam.chat_spam_module import ChatSpamModule
from src.modules.clips.clips_module import ClipsModule
from src.modules.creator_eligibility.creator_eligibility_module import CreatorEligibilityModule
from src.modules.domain_events.domain_events_module import DomainEventsModule
from src.modules.events_ingestion.events_ingestion_module import EventsIngestionModule
from src.modules.experiments.experiments_module import ExperimentsModule
from src.modules.extended_risk.extended_risk_module import ExtendedRiskModule
from src.modules.feed.feed_module import FeedModule
from src.modules.help_content.help_content_module import HelpContentModule
from src.modules.model_registry.model_registry_module import ModelRegistryModule
from src.modules.moderation.moderation_module import ModerationModule
from src.modules.recommendations.recommendations_module import RecommendationsModule
from src.modules.risk.risk_module import RiskModule
from src.modules.search.search_module import SearchModule
from src.modules.social_proof.social_proof_module import SocialProofModule
from src.modules.trending.trending_module import TrendingModule
from src.modules.verification_eligibility.verification_eligibility_module import VerificationEligibilityModule
from src.routes.health_routes import build_health_router


def list_intelligence_modules() -> list[IntelligenceModule]:
    return [
        EventsIngestionModule(),
        DomainEventsModule(),
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
        ChatSpamModule(),
        BotDetectionModule(),
        ModerationModule(),
        CreatorEligibilityModule(),
        ExtendedRiskModule(),
        AdClickPredictionModule(),
        HelpContentModule(),
        VerificationEligibilityModule(),
    ]


def load_intelligence_modules(application: FastAPI, container: ApplicationContainer) -> None:
    application.include_router(
        build_health_router(HealthController(container.feature_backend, container.background_job_monitor))
    )
    for module in list_intelligence_modules():
        module.register_handlers(container)
        application.include_router(module.build_router(container))
