import asyncio
from collections.abc import Sequence
from datetime import datetime
from typing import Any, cast
from unittest.mock import patch

from src.configs.settings_config import IntelligenceSettings
from src.container import ApplicationContainer, build_application_container
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.integrations.media_fingerprint_integration import (
    MEDIA_FINGERPRINT_CONCURRENCY_LIMIT,
    media_fingerprint_semaphore,
)
from src.interfaces.feature_backend_interface import FeatureBackendUnavailableError
from src.modules.ad_click_prediction.dtos.ad_click_prediction_dto import AdClickPredictionRequest
from src.modules.ads.dtos.ad_selection_dto import AdSelectionRequest
from src.modules.chat_spam.dtos.chat_spam_dto import ChatSpamRequest
from src.modules.chat_spam.services.chat_spam_scoring_service import ChatSpamScoringService
from src.modules.moderation.dtos.content_moderation_dto import ContentModerationRequest
from src.modules.moderation.services.content_moderation_service import ContentModerationService
from src.modules.moderation.services.moderation_model_interface_service import ModerationModelHolder
from src.modules.recommendations.dtos.recommendation_dto import ProductRecommendationRequest
from src.modules.risk.dtos.risk_scoring_dto import RiskScoringRequest
from src.modules.risk.dtos.value_transfer_risk_dto import CoinTransferRiskSignals
from src.modules.risk.services.value_flow_feature_service import ValueFlowSignals
from src.modules.risk.services.value_transfer_risk_rules_service import evaluate_coin_transfer_risk_rules
from src.modules.trending.dtos.headline_dto import HeadlineRequest
from src.modules.trending.queries.build_headlines.build_headlines_handler import BuildHeadlinesHandler
from src.modules.trending.queries.build_headlines.build_headlines_query import BuildHeadlinesQuery
from tests.conftest import build_event, build_viewer
from tests.modules.ad_click_prediction.test_ad_click_prediction import prediction_payload
from tests.modules.ads.test_ad_auction_and_pricing import build_ad_candidate
from tests.modules.feed.test_feed_ranking import build_feed_candidates, rank_feed


async def test_missing_models_mark_responses_degraded(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    feed = await rank_feed(
        application_container,
        {
            "viewer": build_viewer(),
            "candidates": build_feed_candidates(reference_now, 5),
            "now": reference_now.isoformat(),
        },
    )
    assert feed.metadata.degraded is True
    assert feed.metadata.model_version is None
    order_request = RiskScoringRequest.model_validate(
        {
            "subjectType": "order",
            "subjectId": "order_1",
            "actorId": "actor_1",
            "exchangeRates": [{"currency": "NGN", "usdPerMajorUnit": "0.00065"}],
            "order": {
                "amount": {"amountMinor": 1000, "currency": "NGN"},
                "accountAgeHours": 100,
                "buyerPreviousOrderCount": 2,
            },
            "now": reference_now.isoformat(),
        }
    )
    risk = await application_container.risk_scoring_service.score_risk(order_request)
    assert risk.metadata.degraded is True
    ad_request = AdSelectionRequest.model_validate(
        {
            "placement": "feed",
            "viewer": build_viewer(),
            "organicItems": [],
            "candidates": [build_ad_candidate("ad_1", "adv_1", "cpc", 5000).model_dump(by_alias=True, mode="json")],
            "exchangeRates": [{"currency": "USD", "usdPerMajorUnit": "1.0"}],
            "now": reference_now.isoformat(),
        }
    )
    ads = await application_container.ad_selection_service.select_ads(ad_request)
    assert ads.metadata.degraded is True
    ctr_request = AdClickPredictionRequest.model_validate({**prediction_payload(), "now": reference_now.isoformat()})
    ctr = await application_container.ad_click_prediction_service.predict_ad_click_rate(ctr_request)
    assert ctr.metadata.degraded is True
    product_request = ProductRecommendationRequest.model_validate(
        {
            "surface": "mart_home",
            "viewer": build_viewer(),
            "candidates": [],
            "limit": 5,
            "now": reference_now.isoformat(),
        }
    )
    products = await application_container.product_recommendation_service.recommend_products(product_request)
    assert products.metadata.degraded is True


async def test_chat_spam_unavailable_store_floors_to_throttle(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    service = application_container.chat_spam_scoring_service
    service.feature_store = None
    request = ChatSpamRequest.model_validate(
        {
            "senderId": "quiet_sender",
            "behaviour": {"accountAgeHours": 900, "messagesLastHour": 1},
            "useStoredBehaviour": True,
            "now": reference_now.isoformat(),
        }
    )
    response = await service.score_chat_spam(request)
    assert response.metadata.degraded is True
    assert response.recommended_action == "throttle"
    assert response.level == "medium"
    service.feature_store = application_container.feature_store


async def test_chat_spam_backend_outage_floors_to_throttle(
    intelligence_settings: IntelligenceSettings, reference_now: datetime
) -> None:
    class OutageBackend(InMemoryFeatureBackend):
        async def read_hash_fields(self, _keys: Sequence[str]) -> list[dict[str, float]]:
            raise FeatureBackendUnavailableError("redis down")

    container = build_application_container(intelligence_settings, OutageBackend())
    service: ChatSpamScoringService = container.chat_spam_scoring_service
    request = ChatSpamRequest.model_validate(
        {
            "senderId": "sender_outage",
            "behaviour": {"accountAgeHours": 900, "messagesLastHour": 1},
            "useStoredBehaviour": True,
            "now": reference_now.isoformat(),
        }
    )
    response = await service.score_chat_spam(request)
    assert response.metadata.degraded is True
    assert response.recommended_action == "throttle"
    assert response.level == "medium"


def test_value_flow_unavailable_reason_is_nonzero() -> None:
    signals = CoinTransferRiskSignals.model_validate(
        {
            "recipientId": "recipient_1",
            "coinAmount": 10,
            "senderAccountAgeHours": 500,
            "recipientAccountAgeHours": 500,
        }
    )
    reasons = evaluate_coin_transfer_risk_rules(signals, ValueFlowSignals())
    codes = {reason.code: reason.weight for reason in reasons}
    assert codes.get("value_flow_unavailable", 0.0) > 0.0


async def test_text_moderation_degraded_allow_becomes_review(reference_now: datetime) -> None:
    holder = ModerationModelHolder()
    service = ContentModerationService(holder)

    class BrokenModel:
        version = "broken-v1"

        def classify(self, _text: str, _content_type: object) -> dict[str, float]:
            raise RuntimeError("model down")

    holder.register_model(cast(Any, BrokenModel()))
    response = await service.classify_content(
        ContentModerationRequest(content_id="c1", content_type="comment", text="hello there", now=reference_now)
    )
    assert response.metadata.degraded is True
    assert response.suggested_action == "review"


async def test_cpu_cores_run_off_the_event_loop(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    real_to_thread = asyncio.to_thread
    calls: list[str] = []

    async def recording_to_thread(func: Any, *args: Any, **kwargs: Any) -> Any:
        calls.append(getattr(func, "__name__", type(func).__name__))
        return await real_to_thread(func, *args, **kwargs)

    with patch("asyncio.to_thread", recording_to_thread):
        await rank_feed(
            application_container,
            {
                "viewer": build_viewer(),
                "candidates": build_feed_candidates(reference_now, 5),
                "now": reference_now.isoformat(),
            },
        )
        handler = BuildHeadlinesHandler()
        await handler.execute(
            BuildHeadlinesQuery(
                request=HeadlineRequest.model_validate(
                    {
                        "posts": [
                            {
                                "postId": f"p{index}",
                                "authorId": f"a{index}",
                                "text": "fashion week highlights and runway reviews",
                                "createdAt": reference_now.isoformat(),
                                "hashtags": ["fashion"],
                            }
                            for index in range(3)
                        ],
                        "limit": 5,
                        "minimumPostsPerStory": 2,
                        "minimumDistinctAuthors": 2,
                    }
                )
            )
        )
        await application_container.event_ingestion_service.ingest_event_batch(
            [
                build_event(
                    "evt_thread_1",
                    "post_liked",
                    "viewer_thread",
                    reference_now,
                    {"postId": "p1", "authorId": "author_1", "topics": ["fashion"]},
                    country="NG",
                )
            ],
            reference_now,
        )
    assert "score_feed_candidates_in_two_stages" in calls
    assert "build_headlines_from_posts" in calls
    assert "validate_raw_events" in calls


def test_media_fingerprint_path_is_bounded() -> None:
    assert MEDIA_FINGERPRINT_CONCURRENCY_LIMIT == 8
    assert isinstance(media_fingerprint_semaphore, asyncio.Semaphore)
