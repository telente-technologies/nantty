from datetime import datetime
from typing import Any

from src.container import ApplicationContainer
from src.interfaces.feature_backend_interface import HashFieldAssign
from src.modules.model_registry.models.model_bundle_model import ItemSimilarityBundle, LoadedModel
from src.modules.recommendations.dtos.recommendation_dto import (
    ProductCandidateRecallRequest,
    ProductRecommendationRequest,
)
from src.modules.recommendations.services import product_recommendation_service
from src.repositories.online_feature_keyspace_repository import PERSONALIZATION_OPT_OUT_FIELD
from tests.conftest import SignedIntelligenceClient, build_event, build_viewer


def install_similarity_bundle(container: ApplicationContainer) -> None:
    container.model_holder.install_loaded_model(
        LoadedModel(
            model_name="item_similarity",
            version="20260101T000000Z-abcdef12",
            metadata={},
            bundle=ItemSimilarityBundle(
                similar_items={"anchor": [("product_1", 0.9), ("product_2", 0.5), ("product_3", 0.1)]},
                bought_together_items={"anchor": [("product_basket", 3.0)]},
                popular_items=[("product_popular", 9.0), ("anchor", 5.0)],
            ),
        )
    )


def build_product(product_id: str, store_id: str, **overrides: Any) -> dict[str, Any]:
    return {"productId": product_id, "storeId": store_id, **overrides}


def test_product_for_you_exploration_is_stable_within_a_day_and_rotates_daily(monkeypatch: Any) -> None:
    base = {"surface": "for_you", "viewer": build_viewer(userId="viewer_1"), "candidates": []}
    request = ProductRecommendationRequest.model_validate(base)
    day_one = datetime.fromisoformat("2026-11-07T08:00:00+00:00")
    same_day = datetime.fromisoformat("2026-11-07T23:00:00+00:00")
    next_day = datetime.fromisoformat("2026-11-08T08:00:00+00:00")

    monkeypatch.setattr(product_recommendation_service, "resolve_request_time", lambda _requested: day_one)
    first_score = product_recommendation_service.calculate_product_exploration_tiebreaker(
        request, "product_1", 0.02, 24
    )
    monkeypatch.setattr(product_recommendation_service, "resolve_request_time", lambda _requested: same_day)
    assert (
        product_recommendation_service.calculate_product_exploration_tiebreaker(request, "product_1", 0.02, 24)
        == first_score
    )
    monkeypatch.setattr(product_recommendation_service, "resolve_request_time", lambda _requested: next_day)
    assert (
        product_recommendation_service.calculate_product_exploration_tiebreaker(request, "product_1", 0.02, 24)
        != first_score
    )
    assert product_recommendation_service.calculate_product_exploration_tiebreaker(request, "product_1", 0.0, 24) == 0.0
    assert (
        abs(product_recommendation_service.calculate_product_exploration_tiebreaker(request, "product_1", 1.0, 24))
        <= 0.05
    )


async def test_internal_product_candidate_recall_route_is_signed_and_consent_gated(
    signed_client: SignedIntelligenceClient, reference_now: datetime
) -> None:
    await signed_client.feature_backend.apply_write_operations(
        [HashFieldAssign(signed_client.keyspace.consent_key("u_viewer_hash"), PERSONALIZATION_OPT_OUT_FIELD, 0.0)]
    )
    event = build_event(
        "candidate-recall-view",
        "product_viewed",
        "u_viewer_hash",
        reference_now,
        {"productId": "product_long_tail", "storeId": "store_1"},
    )
    ingestion = await signed_client.post("/v1/events", {"events": [event]})
    assert ingestion.status_code == 200, ingestion.text

    recalled = await signed_client.post(
        "/v1/recommendations/products/candidates",
        {"viewer": build_viewer("u_viewer_hash"), "personalizationAllowed": True, "limit": 50},
    )
    assert recalled.status_code == 200, recalled.text
    assert recalled.json()["itemIds"] == ["product_long_tail"]

    withheld = await signed_client.post(
        "/v1/recommendations/products/candidates",
        {"viewer": build_viewer("u_viewer_hash"), "personalizationAllowed": False, "limit": 50},
    )
    assert withheld.status_code == 200, withheld.text
    assert withheld.json()["itemIds"] == []


async def recommend(
    container: ApplicationContainer, surface: str, candidates: list[dict[str, Any]], **overrides: Any
) -> list[tuple[str, str]]:
    request = ProductRecommendationRequest.model_validate(
        {"surface": surface, "viewer": build_viewer(), "candidates": candidates, **overrides}
    )
    response = await container.product_recommendation_service.recommend_products(request)
    return [(item.item_id, item.reason) for item in response.items]


async def test_similar_products_follow_model_neighbour_order_and_drop_ineligible_items(
    application_container: ApplicationContainer,
) -> None:
    install_similarity_bundle(application_container)
    candidates = [
        build_product("product_3", "store_c"),
        build_product("product_2", "store_b"),
        build_product("product_1", "store_a"),
        build_product("anchor", "store_a"),
        build_product("product_excluded", "store_d"),
        build_product("product_out_of_stock", "store_e", inStock=False),
        build_product("product_blocked_store", "store_blocked"),
    ]
    items = await recommend(
        application_container,
        "similar",
        candidates,
        anchorProduct=build_product("anchor", "store_a"),
        excludedProductIds=["product_excluded"],
        viewer=build_viewer(blockedAccountIds=["store_blocked"]),
    )
    assert [item_id for item_id, _reason in items] == ["product_1", "product_2", "product_3"]


async def test_mart_home_never_shows_more_than_two_consecutive_products_from_one_store(
    application_container: ApplicationContainer,
) -> None:
    candidates = [build_product(f"a_{index}", "store_a", salesCount=100 - index) for index in range(6)]
    candidates += [build_product(f"b_{index}", "store_b", salesCount=1) for index in range(2)]
    items = await recommend(application_container, "mart_home", candidates, limit=8)
    stores = [item_id.split("_")[0] for item_id, _reason in items]
    assert len(stores) == 8
    assert all(not (stores[index] == stores[index + 1] == stores[index + 2]) for index in range(len(stores) - 2))


async def test_product_for_you_prefers_verified_stores_without_excluding_other_stores(
    application_container: ApplicationContainer,
) -> None:
    candidates = [
        # The non-verified product has much stronger popularity, but trust tier
        # remains the first ordering constraint; behavior/popularity rank within
        # each tier and non-verified products are not excluded.
        build_product("unverified", "store_a", salesCount=100_000, viewCount=200_000),
        build_product("verified", "store_b", salesCount=10, viewCount=20, storeVerified=True),
    ]
    items = await recommend(application_container, "for_you", candidates, requestId="stable-request")

    assert [item_id for item_id, _reason in items] == ["verified", "unverified"]
    assert items[0][1] == "verified_store"
    assert items[1][1] == "personalized"


async def test_clips_surface_prefers_verified_stores_without_excluding_other_stores(
    application_container: ApplicationContainer,
) -> None:
    candidates = [
        build_product("unverified", "store_a", salesCount=100_000, viewCount=200_000),
        build_product("verified", "store_b", salesCount=10, viewCount=20, storeVerified=True),
    ]
    items = await recommend(application_container, "clips", candidates, requestId="clips-request")

    assert [item_id for item_id, _reason in items] == ["verified", "unverified"]
    assert items[0][1] == "verified_store"


async def test_mart_home_applies_verified_tier_before_page_limit(
    application_container: ApplicationContainer,
) -> None:
    candidates = [
        build_product("unverified_top_seller", "store_a", salesCount=100_000, viewCount=200_000),
        build_product("verified_store", "store_b", salesCount=1, viewCount=1, storeVerified=True),
    ]

    items = await recommend(application_container, "mart_home", candidates, limit=1)

    assert [item_id for item_id, _reason in items] == ["verified_store"]


async def test_mart_home_rotates_equivalent_products_within_verified_tier(
    application_container: ApplicationContainer, monkeypatch: Any,
) -> None:
    monkeypatch.setattr(product_recommendation_service, "resolve_request_time", lambda requested: requested)
    candidates = [
        build_product(f"verified_{index:02d}", f"verified_store_{index}", storeVerified=True, salesCount=1)
        for index in range(8)
    ] + [
        build_product(f"other_{index:02d}", f"other_store_{index}", salesCount=1)
        for index in range(4)
    ]
    before_rotation = await recommend(
        application_container,
        "mart_home",
        candidates,
        limit=12,
        now="2026-11-07T08:00:00+00:00",
    )
    after_rotation = await recommend(
        application_container,
        "mart_home",
        candidates,
        limit=12,
        now="2026-11-08T08:00:00+00:00",
    )

    before_ids = [item_id for item_id, _reason in before_rotation]
    after_ids = [item_id for item_id, _reason in after_rotation]
    assert set(before_ids) == set(after_ids) == {candidate["productId"] for candidate in candidates}
    assert before_ids != after_ids
    assert all(item_id.startswith("verified_") for item_id in before_ids[:8])
    assert all(item_id.startswith("verified_") for item_id in after_ids[:8])


async def test_product_for_you_uses_product_views_and_search_clicks_as_personal_signals(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    await application_container.feature_store.feature_backend.apply_write_operations(
        [
            HashFieldAssign(
                application_container.feature_store.keyspace.consent_key("viewer_1"),
                PERSONALIZATION_OPT_OUT_FIELD,
                0.0,
            )
        ]
    )
    events = [
        build_event(
            "view_interested",
            "product_viewed",
            "viewer_1",
            reference_now,
            {"productId": "interested", "storeId": "store_a"},
        ),
        build_event(
            "cart_interested",
            "added_to_cart",
            "viewer_1",
            reference_now,
            {"productId": "interested", "storeId": "store_a", "quantity": 1},
        ),
        build_event(
            "search_click_interested",
            "searched",
            "viewer_1",
            reference_now,
            {
                "queryHash": "fashion-query",
                "resultCount": 2,
                "clickedItemId": "interested",
                "clickedItemType": "product",
            },
        ),
    ]
    await application_container.event_ingestion_service.ingest_event_batch(events, reference_now)

    recalled = await application_container.product_recommendation_service.recall_product_candidates(
        ProductCandidateRecallRequest.model_validate(
            {"viewer": build_viewer(), "personalizationAllowed": True, "now": reference_now.isoformat()}
        )
    )
    assert recalled == ["interested"]
    withheld = await application_container.product_recommendation_service.recall_product_candidates(
        ProductCandidateRecallRequest.model_validate(
            {"viewer": build_viewer(), "personalizationAllowed": False, "now": reference_now.isoformat()}
        )
    )
    assert withheld == []

    items = await recommend(
        application_container,
        "for_you",
        [
            build_product("popular", "store_b", viewCount=100_000),
            build_product("interested", "store_a"),
        ],
        viewer=build_viewer(),
        personalizationAllowed=True,
        requestId="interaction-test",
        now=reference_now.isoformat(),
    )

    assert [item_id for item_id, _reason in items] == ["interested", "popular"]


async def test_without_candidates_model_neighbours_or_popular_fallback_are_served(
    application_container: ApplicationContainer,
) -> None:
    install_similarity_bundle(application_container)
    neighbours = await recommend(application_container, "similar", [], anchorProduct=build_product("anchor", "s"))
    unknown_anchor = await recommend(application_container, "similar", [], anchorProduct=build_product("new", "s"))
    bought_together = await recommend(
        application_container, "bought_together", [], anchorProduct=build_product("anchor", "s")
    )
    assert [item_id for item_id, _reason in neighbours] == ["product_1", "product_2", "product_3"]
    assert unknown_anchor == [("product_popular", "popular"), ("anchor", "popular")]
    assert bought_together == [("product_basket", "bought_together")]
