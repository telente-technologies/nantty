import pytest
from pydantic import ValidationError

from src.configs.settings_config import IntelligenceSettings
from src.container import ApplicationContainer, build_application_container
from src.interfaces.feature_backend_interface import FeatureBackend
from src.modules.recommendations.dtos.recommendation_dto import ProductRecommendationRequest
from tests.conftest import build_viewer


def test_product_recommendation_tuning_has_safe_bounds() -> None:
    settings = IntelligenceSettings(
        environment="test",
        shared_secret="test-shared-secret-that-is-long-enough-000",
        product_recommendation_verified_store_bonus=0.2,
        product_recommendation_exploration_max_offset=0.05,
        product_recommendation_exploration_rotation_hours=168,
    )

    assert settings.product_recommendation_verified_store_bonus == 0.2
    assert settings.product_recommendation_exploration_max_offset == 0.05
    assert settings.product_recommendation_exploration_rotation_hours == 168

    with pytest.raises(ValidationError):
        IntelligenceSettings(
            environment="test",
            shared_secret="test-shared-secret-that-is-long-enough-000",
            product_recommendation_verified_store_bonus=0.21,
        )


async def test_disabling_verified_bonus_and_exploration_uses_base_tie_order(
    intelligence_settings: IntelligenceSettings,
    feature_backend: FeatureBackend,
) -> None:
    settings = intelligence_settings.model_copy(
        update={
            "product_recommendation_verified_store_bonus": 0.0,
            "product_recommendation_exploration_max_offset": 0.0,
        }
    )
    container: ApplicationContainer = build_application_container(settings, feature_backend)
    response = await container.product_recommendation_service.recommend_products(
        ProductRecommendationRequest.model_validate(
            {
                "surface": "for_you",
                "viewer": build_viewer(),
                "candidates": [
                    {"productId": "a_verified", "storeId": "store_a", "storeVerified": True},
                    {"productId": "z_unverified", "storeId": "store_b", "storeVerified": False},
                ],
                "personalizationAllowed": True,
            }
        )
    )

    assert [item.item_id for item in response.items] == ["a_verified", "z_unverified"]
    assert all(item.reason == "personalized" for item in response.items)
