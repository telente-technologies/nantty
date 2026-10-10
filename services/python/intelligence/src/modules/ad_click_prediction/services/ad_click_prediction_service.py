import logging

from src.configs.ranking_heuristics_config import AD_CLICK_HEURISTIC_HEADS
from src.dtos.common_dto import RankingResponseMetadata
from src.interfaces.feature_backend_interface import FeatureBackendUnavailableError
from src.modules.ad_click_prediction.dtos.ad_click_prediction_dto import (
    AdClickPrediction,
    AdClickPredictionRequest,
    AdClickPredictionResponse,
)
from src.modules.ads.services.ad_feature_vector_service import AD_FEATURE_NAMES, build_ad_feature_values
from src.modules.model_registry.services.active_model_holder_service import ActiveModelHolder
from src.repositories.online_feature_repository import OnlineFeatureStore
from src.services.head_probability_predictor_service import predict_heads_with_model_or_heuristic
from src.services.ranking_context_service import resolve_request_identifier, resolve_request_time

prediction_logger = logging.getLogger("intelligence.ad_click_prediction")
VIEWER_TOPIC_AFFINITY_LIMIT = 30


class AdClickPredictionService:
    def __init__(self, feature_store: OnlineFeatureStore | None, model_holder: ActiveModelHolder) -> None:
        self.feature_store = feature_store
        self.model_holder = model_holder

    async def predict_ad_click_rate(self, request: AdClickPredictionRequest) -> AdClickPredictionResponse:
        now = resolve_request_time(request.now)
        statistics: dict[str, dict[str, float]] = {}
        affinity: dict[str, float] = {}
        degraded = self.feature_store is None
        if self.feature_store is not None:
            try:
                statistics = await self.feature_store.read_ad_statistics([ad.ad_id for ad in request.candidates])
                affinity = {
                    topic: score
                    for topic, score in await self.feature_store.read_viewer_top_topic_affinities(
                        request.viewer.user_id, VIEWER_TOPIC_AFFINITY_LIMIT, now
                    )
                    if score > 0
                }
            except FeatureBackendUnavailableError:
                prediction_logger.warning("ad_prediction_features_unavailable")
                degraded = True
        chosen_topics = frozenset(request.viewer.chosen_topics)
        followed = frozenset(request.viewer.followed_account_ids)
        feature_rows = [
            build_ad_feature_values(
                candidate,
                request.placement,
                statistics.get(candidate.ad_id, {}),
                affinity,
                chosen_topics,
                followed,
                0.0,
            )
            for candidate in request.candidates
        ]
        loaded_model = self.model_holder.get_loaded_model("ad_click")
        prediction = predict_heads_with_model_or_heuristic(
            feature_rows,
            AD_FEATURE_NAMES,
            loaded_model.bundle if loaded_model else None,
            loaded_model.version if loaded_model else None,
            AD_CLICK_HEURISTIC_HEADS,
        )
        click_rates = prediction.probabilities_by_head["click"]
        return AdClickPredictionResponse(
            predictions=[
                AdClickPrediction(ad_id=candidate.ad_id, predicted_click_rate=round(float(click_rates[index]), 6))
                for index, candidate in enumerate(request.candidates)
            ],
            personalized=bool(affinity),
            metadata=RankingResponseMetadata(
                request_id=resolve_request_identifier(request.request_id),
                ranking_source=f"ad_ctr:{prediction.ranking_source}",
                model_version=prediction.model_version,
                degraded=degraded or prediction.model_version is None,
                generated_at=now,
            ),
        )
