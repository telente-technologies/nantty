import logging
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from src.configs.ranking_heuristics_config import AD_CLICK_HEURISTIC_HEADS
from src.dtos.common_dto import MoneyAmount, RankingResponseMetadata
from src.enums.ranking_surface_enum import RankingSurface
from src.interfaces.feature_backend_interface import FeatureBackendUnavailableError
from src.modules.ads.constants.ad_placement_policy_constant import AD_PLACEMENT_POLICIES
from src.modules.ads.dtos.ad_selection_dto import (
    AdPlacementDecision,
    AdSelectionRequest,
    AdSelectionResponse,
    RejectedAd,
)
from src.modules.ads.services.ad_auction_service import (
    AuctionEntry,
    AuctionWinner,
    calculate_effective_cpm_usd_micros,
    run_generalized_second_price_auction,
)
from src.modules.ads.services.ad_eligibility_service import AdEligibilityContext, EligibleAd, evaluate_ad_eligibility
from src.modules.ads.services.ad_feature_vector_service import (
    AD_FEATURE_NAMES,
    AD_FEATURE_SCHEMA_VERSION,
    build_ad_feature_values,
)
from src.modules.ads.services.ad_load_service import AdSlot, assign_ranked_ads_to_slots, calculate_brand_safe_ad_slots
from src.modules.model_registry.models.model_bundle_model import ItemSimilarityBundle
from src.modules.model_registry.services.active_model_holder_service import ActiveModelHolder
from src.repositories.feature_log_parquet_repository import FeatureLogParquetSink
from src.repositories.online_feature_repository import OnlineFeatureStore
from src.services.currency_conversion_service import build_usd_rate_lookup, convert_money_to_usd_micros
from src.services.head_probability_predictor_service import predict_heads_with_model_or_heuristic
from src.services.ranking_context_service import (
    log_served_feature_rows,
    resolve_request_identifier,
    resolve_request_time,
)

ad_selection_logger = logging.getLogger("intelligence.ads")
VIEWER_INTEREST_TOPIC_LIMIT = 30
VIEWER_INTEREST_MINIMUM_AFFINITY = 1.0


@dataclass(frozen=True, slots=True)
class AdOnlineSignals:
    ad_statistics: dict[str, dict[str, float]] = field(default_factory=dict)
    impressions_today_by_campaign: dict[str, float] = field(default_factory=dict)
    spend_today_by_campaign: dict[str, dict[str, float]] = field(default_factory=dict)
    viewer_topic_affinity: dict[str, float] = field(default_factory=dict)


def calculate_ad_slots_for_request(request: AdSelectionRequest) -> list[AdSlot]:
    host_is_unsafe = request.host_content_is_sensitive or request.host_content_is_reported
    if request.host_content_id is not None and host_is_unsafe:
        return []
    in_content_slot = [AdSlot(organic_items_before_slot=0, is_safe_for_strict_brand_safety=True)]
    if AD_PLACEMENT_POLICIES[request.placement].is_in_content_placement:
        return in_content_slot[: request.ad_load.maximum_ads] if request.host_content_id is not None else []
    if request.host_content_id is not None and not request.organic_items:
        return in_content_slot[: request.ad_load.maximum_ads]
    return calculate_brand_safe_ad_slots(request.organic_items, request.ad_load, request.placement)


def describe_missing_slot_reason(request: AdSelectionRequest) -> str:
    if request.host_content_id is not None and (request.host_content_is_sensitive or request.host_content_is_reported):
        return "host_content_not_brand_safe"
    if AD_PLACEMENT_POLICIES[request.placement].is_in_content_placement and request.host_content_id is None:
        return "in_content_placement_requires_host_content"
    return "no_brand_safe_slot"


def resolve_reserve_price_or_reject(
    reserve: MoneyAmount | None,
    eligible_ads: list[EligibleAd],
    usd_rate_lookup: dict[str, Decimal],
) -> tuple[Decimal, list[RejectedAd]]:
    if reserve is None:
        return Decimal(0), []
    converted = convert_money_to_usd_micros(reserve, usd_rate_lookup)
    if converted is None:
        return Decimal(0), [
            RejectedAd(ad_id=eligible.candidate.ad_id, reason="reserve_unavailable") for eligible in eligible_ads
        ]
    return converted, []


class AdSelectionService:
    def __init__(
        self,
        feature_store: OnlineFeatureStore | None,
        model_holder: ActiveModelHolder,
        feature_log_sink: FeatureLogParquetSink | None,
    ) -> None:
        self.feature_store = feature_store
        self.model_holder = model_holder
        self.feature_log_sink = feature_log_sink

    async def read_online_signals(self, request: AdSelectionRequest, now: datetime) -> tuple[AdOnlineSignals, bool]:
        if self.feature_store is None:
            return AdOnlineSignals(), True
        try:
            return (
                AdOnlineSignals(
                    ad_statistics=await self.feature_store.read_ad_statistics([ad.ad_id for ad in request.candidates]),
                    impressions_today_by_campaign=await self.feature_store.read_viewer_ad_frequency_today(
                        request.viewer.user_id, now
                    ),
                    spend_today_by_campaign=await self.feature_store.read_campaign_spend_today(
                        [ad.campaign_id for ad in request.candidates], now
                    ),
                    viewer_topic_affinity=dict(
                        await self.feature_store.read_viewer_top_topic_affinities(
                            request.viewer.user_id, VIEWER_INTEREST_TOPIC_LIMIT, now
                        )
                    ),
                ),
                False,
            )
        except FeatureBackendUnavailableError:
            ad_selection_logger.warning("ad_online_signals_unavailable")
            return AdOnlineSignals(), True

    async def select_ads(self, request: AdSelectionRequest) -> AdSelectionResponse:
        now = resolve_request_time(request.now)
        auction_id = resolve_request_identifier(request.request_id)
        signals, degraded = await self.read_online_signals(request, now)
        similarity_bundle = self.model_holder.get_active_bundle("item_similarity")
        centroids = (
            similarity_bundle.store_customer_topic_centroids
            if isinstance(similarity_bundle, ItemSimilarityBundle)
            else {}
        )
        usd_rate_lookup = build_usd_rate_lookup(request.exchange_rates)
        impressions_today = dict(signals.impressions_today_by_campaign)
        for campaign_id, count in request.viewer_impressions_today_by_campaign.items():
            impressions_today[campaign_id] = max(impressions_today.get(campaign_id, 0.0), float(count))
        positive_affinity = {topic: score for topic, score in signals.viewer_topic_affinity.items() if score > 0}
        interest_topics = frozenset(request.viewer.chosen_topics) | frozenset(
            topic for topic, score in positive_affinity.items() if score >= VIEWER_INTEREST_MINIMUM_AFFINITY
        )
        context = AdEligibilityContext(
            viewer=request.viewer,
            placement=request.placement,
            now=now,
            auction_id=auction_id,
            usd_rate_lookup=usd_rate_lookup,
            viewer_interest_topics=interest_topics,
            viewer_topic_affinity=positive_affinity,
            impressions_today_by_campaign=impressions_today,
            online_spend_today_by_campaign=signals.spend_today_by_campaign,
            store_customer_topic_centroids=centroids,
        )
        rejected: list[RejectedAd] = []
        eligible_ads: list[EligibleAd] = []
        seen_ad_ids: set[str] = set()
        for candidate in request.candidates:
            if candidate.ad_id in seen_ad_ids:
                rejected.append(RejectedAd(ad_id=candidate.ad_id, reason="duplicate_candidate"))
                continue
            seen_ad_ids.add(candidate.ad_id)
            outcome = evaluate_ad_eligibility(candidate, context)
            if isinstance(outcome, str):
                rejected.append(RejectedAd(ad_id=candidate.ad_id, reason=outcome))
            else:
                eligible_ads.append(outcome)
        feature_rows = [
            build_ad_feature_values(
                eligible.candidate,
                request.placement,
                signals.ad_statistics.get(eligible.candidate.ad_id, {}),
                positive_affinity,
                frozenset(request.viewer.chosen_topics),
                frozenset(request.viewer.followed_account_ids),
                eligible.lookalike_similarity,
            )
            for eligible in eligible_ads
        ]
        loaded_model = self.model_holder.get_loaded_model("ad_click")
        prediction = predict_heads_with_model_or_heuristic(
            feature_rows,
            AD_FEATURE_NAMES,
            loaded_model.bundle if loaded_model else None,
            loaded_model.version if loaded_model else None,
            AD_CLICK_HEURISTIC_HEADS,
        )
        entries = []
        reserve_usd_micros, reserve_rejections = resolve_reserve_price_or_reject(
            request.reserve_price_per_mille, eligible_ads, usd_rate_lookup
        )
        rejected += reserve_rejections
        if reserve_rejections:
            eligible_ads = []
        for index, eligible in enumerate(eligible_ads):
            click_rate = float(prediction.probabilities_by_head["click"][index])
            entries.append(AuctionEntry(eligible, click_rate, calculate_effective_cpm_usd_micros(eligible, click_rate)))
        slots = calculate_ad_slots_for_request(request)
        auction = run_generalized_second_price_auction(entries, len(slots), reserve_usd_micros, usd_rate_lookup)
        missing_slot_reason = describe_missing_slot_reason(request)
        rejected += [
            RejectedAd(ad_id=ad_id, reason=missing_slot_reason if not slots and reason == "outbid" else reason)
            for ad_id, reason in auction.losing_reasons.items()
        ]
        assignments = assign_ranked_ads_to_slots(
            auction.winners,
            slots,
            {
                index: winner.entry.eligible_ad.candidate.brand_safety == "strict"
                for index, winner in enumerate(auction.winners)
            },
        )
        assigned_ad_ids = {winner.entry.eligible_ad.candidate.ad_id for _slot, winner in assignments}
        rejected += [
            RejectedAd(ad_id=winner.entry.eligible_ad.candidate.ad_id, reason=missing_slot_reason)
            for winner in auction.winners
            if winner.entry.eligible_ad.candidate.ad_id not in assigned_ad_ids
        ]
        placements = [
            self.build_placement_decision(winner, slot.organic_items_before_slot, index, request, auction_id)
            for index, (slot, winner) in enumerate(assignments)
        ]
        feature_rows_by_ad = {
            eligible.candidate.ad_id: row for eligible, row in zip(eligible_ads, feature_rows, strict=True)
        }
        log_served_feature_rows(
            self.feature_log_sink,
            auction_id,
            RankingSurface.ADS,
            request.viewer.user_id,
            [placement.ad_id for placement in placements],
            feature_rows_by_ad,
            prediction.model_version,
            AD_FEATURE_SCHEMA_VERSION,
            now,
        )
        return AdSelectionResponse(
            placements=placements,
            rejected=rejected,
            metadata=RankingResponseMetadata(
                request_id=auction_id,
                ranking_source=f"ads:{prediction.ranking_source}",
                model_version=prediction.model_version,
                degraded=degraded or prediction.model_version is None,
                generated_at=now,
            ),
        )

    @staticmethod
    def build_placement_decision(
        winner: AuctionWinner,
        organic_items_before_slot: int,
        ads_already_placed: int,
        request: AdSelectionRequest,
        auction_id: str,
    ) -> AdPlacementDecision:
        candidate = winner.entry.eligible_ad.candidate
        return AdPlacementDecision(
            ad_id=candidate.ad_id,
            campaign_id=candidate.campaign_id,
            advertiser_id=candidate.advertiser_id,
            placement=request.placement,
            position=organic_items_before_slot + ads_already_placed,
            insert_after_item_id=(
                request.organic_items[organic_items_before_slot - 1].item_id if organic_items_before_slot > 0 else None
            ),
            host_content_id=request.host_content_id,
            host_creator_id=request.host_creator_id,
            charge_model=candidate.bid_type,
            creative_media_type=candidate.creative.media_type,
            charge_price=MoneyAmount(amount_minor=winner.clearing_price_minor, currency=candidate.bid.currency),
            predicted_click_rate=round(winner.entry.predicted_click_rate, 6),
            auction_id=auction_id,
        )
