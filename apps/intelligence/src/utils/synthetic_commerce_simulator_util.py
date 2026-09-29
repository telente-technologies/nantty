from datetime import datetime, timedelta

import numpy as np

from src.container import ApplicationContainer
from src.modules.ads.dtos.ad_selection_dto import AdSelectionRequest
from src.modules.risk.dtos.risk_scoring_dto import RiskScoringRequest
from src.utils.synthetic_session_simulator_util import SyntheticEventRecorder, draw_probability
from src.utils.synthetic_world_util import (
    SyntheticUser,
    SyntheticWorld,
    calculate_logistic_probability,
    calculate_user_interest,
)


async def simulate_ad_session(
    container: ApplicationContainer,
    world: SyntheticWorld,
    user: SyntheticUser,
    session_time: datetime,
    shown_post_ids: list[str],
    random_generator: np.random.Generator,
    recorder: SyntheticEventRecorder,
) -> None:
    if len(shown_post_ids) < 4:
        return
    candidates = [
        {
            "adId": f"ad_{store_id}",
            "campaignId": f"campaign_{store_id}",
            "advertiserId": store_id,
            "status": "active",
            "bidType": "cpc" if index % 2 else "cpm",
            "bid": {"amountMinor": 5_000 + 1_000 * index, "currency": "NGN"},
            "dailyBudget": {"amountMinor": 50_000_000, "currency": "NGN"},
            "spentToday": {"amountMinor": 0, "currency": "NGN"},
            "spentTotal": {"amountMinor": 0, "currency": "NGN"},
            "placements": ["feed"],
            "creative": {"mediaType": "video", "aspectRatio": "9:16", "durationMs": 15000},
            "creativeTopics": [topic],
            "frequencyCapPerDay": 50,
        }
        for index, (store_id, topic) in enumerate(world.store_topics.items())
    ]
    request = AdSelectionRequest.model_validate(
        {
            "placement": "feed",
            "viewer": {"userId": user.user_id, "country": user.country, "chosenTopics": user.chosen_topics},
            "organicItems": [{"itemId": post_id} for post_id in shown_post_ids],
            "candidates": candidates,
            "exchangeRates": [{"currency": "NGN", "usdPerMajorUnit": "0.00065"}],
            "now": session_time.isoformat(),
        }
    )
    response = await container.ad_selection_service.select_ads(request)
    for placement in response.placements:
        topic = world.store_topics[placement.advertiser_id]
        moment = session_time + timedelta(seconds=10 + placement.position)
        charge = placement.charge_price.model_dump(by_alias=True)
        base = {"adId": placement.ad_id, "campaignId": placement.campaign_id, "auctionId": placement.auction_id}
        recorder.record(
            "ad_impression", user, moment, {**base, "advertiserId": placement.advertiser_id, "placement": "feed"}
        )
        interest = calculate_user_interest(user, topic)
        if draw_probability(random_generator, calculate_logistic_probability(-3.5 + 1.5 * interest)):
            recorder.record("ad_click", user, moment + timedelta(seconds=3), {**base, "charge": charge})


async def simulate_order_risk_check(
    container: ApplicationContainer,
    user: SyntheticUser,
    session_time: datetime,
    random_generator: np.random.Generator,
    recorder: SyntheticEventRecorder,
) -> None:
    share_device = draw_probability(random_generator, 0.1)
    young_account = draw_probability(random_generator, 0.2)
    burst = draw_probability(random_generator, 0.1)
    new_instrument = draw_probability(random_generator, 0.3)
    subject_id = f"risk_order_{recorder.sequence_number:08d}"
    request = RiskScoringRequest.model_validate(
        {
            "subjectType": "order",
            "subjectId": subject_id,
            "actorId": user.user_id,
            "exchangeRates": [{"currency": "NGN", "usdPerMajorUnit": "0.00065"}],
            "order": {
                "amount": {"amountMinor": int(random_generator.integers(5_000, 900_000)) * 100, "currency": "NGN"},
                "accountAgeHours": 5.0 if young_account else float(random_generator.uniform(48, 5000)),
                "buyerPreviousOrderCount": int(random_generator.integers(0, 30)),
                "ordersLastHour": 7 if burst else int(random_generator.integers(0, 3)),
                "deviceAccountCount": int(random_generator.integers(1, 6)),
                "isNewPaymentInstrument": new_instrument,
                "buyerAndSellerShareDevice": share_device,
            },
            "now": session_time.isoformat(),
        }
    )
    await container.risk_scoring_service.score_risk(request)
    fraud_logit = -3.5 + 3 * share_device + 2 * young_account + 1.5 * burst + 1 * new_instrument
    is_fraud = draw_probability(random_generator, calculate_logistic_probability(fraud_logit))
    recorder.record(
        "risk_outcome_labeled",
        user,
        session_time + timedelta(hours=1),
        {
            "subjectType": "order",
            "subjectId": subject_id,
            "outcome": "fraud_confirmed" if is_fraud else "fraud_cleared",
        },
    )
