from datetime import datetime
from typing import Any

from src.container import ApplicationContainer
from src.modules.ad_click_prediction.dtos.ad_click_prediction_dto import AdClickPredictionRequest
from src.modules.ad_click_prediction.services.ad_click_prediction_service import AdClickPredictionService
from tests.conftest import SignedIntelligenceClient
from tests.modules.ads.test_ad_auction_and_pricing import build_ad_candidate
from tests.modules.domain_events.test_domain_event_consumer import domain_event


def prediction_payload(viewer_id: str = "viewer_1") -> dict[str, Any]:
    candidate = build_ad_candidate(
        "ad_1", "adv_1", "cpc", 5000, creativeTopics=["fashion"], lifetimeImpressions=1000, lifetimeClicks=50
    )
    cold = build_ad_candidate("ad_2", "adv_2", "cpm", 5000, creativeTopics=["fashion"])
    return {
        "placement": "feed",
        "viewer": {"userId": viewer_id, "country": "NG", "chosenTopics": ["fashion"]},
        "candidates": [candidate.model_dump(by_alias=True, mode="json"), cold.model_dump(by_alias=True, mode="json")],
    }


async def test_predicted_ctr_contract_and_ordering(signed_client: SignedIntelligenceClient) -> None:
    response = await signed_client.post("/v1/ads/predicted-ctr", prediction_payload())
    assert response.status_code == 200, response.text
    body = response.json()
    assert [item["adId"] for item in body["predictions"]] == ["ad_1", "ad_2"]
    assert all(0.0 < item["predictedClickRate"] < 1.0 for item in body["predictions"])
    assert body["predictions"][0]["predictedClickRate"] > body["predictions"][1]["predictedClickRate"]
    assert body["metadata"]["rankingSource"] == "ad_ctr:heuristic"


async def test_degraded_when_no_feature_store_still_returns_scores(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    service = AdClickPredictionService(None, application_container.model_holder)
    response = await service.predict_ad_click_rate(
        AdClickPredictionRequest.model_validate({**prediction_payload(), "now": reference_now.isoformat()})
    )
    assert response.metadata.degraded is True
    assert len(response.predictions) == 2


async def test_opted_out_viewer_is_not_personalized(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    await consumer.process_message_body(
        domain_event(
            "evt_pv_ctr",
            "product.viewed",
            "viewer_ctr",
            reference_now,
            {"productId": "p", "storeId": "s", "topics": ["fashion"]},
        )
    )
    service = application_container.ad_click_prediction_service
    hashed_viewer = consumer.identifier_hasher.hash_user_id("viewer_ctr")
    request = AdClickPredictionRequest.model_validate(
        {**prediction_payload(hashed_viewer), "now": reference_now.isoformat()}
    )
    assert (await service.predict_ad_click_rate(request)).personalized is True
    await consumer.process_message_body(
        domain_event(
            "evt_opt_ctr", "consent.withdrawn", "viewer_ctr", reference_now, {"consentType": "personalization"}
        )
    )
    assert (await service.predict_ad_click_rate(request)).personalized is False
