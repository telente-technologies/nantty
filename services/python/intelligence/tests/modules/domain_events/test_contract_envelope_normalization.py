import json
from datetime import datetime

from src.container import ApplicationContainer
from src.modules.recommendations.dtos.recommendation_dto import ProductRecommendationRequest


async def test_contract_follow_and_block_envelopes_are_accepted(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    follow_created = {
        "id": "evt_contract_follow",
        "type": "follow.created",
        "source": "social",
        "subject": "follow_1",
        "schemaVersion": 1,
        "occurredAt": reference_now.isoformat(),
        "data": {"followId": "follow_1", "followerId": "fan_1", "followeeId": "creator_1", "state": "accepted"},
    }
    block_created = {
        "id": "evt_contract_block",
        "type": "block.created",
        "source": "social",
        "subject": "fan_1",
        "schemaVersion": 1,
        "occurredAt": reference_now.isoformat(),
        "data": {"blockerId": "fan_1", "blockedId": "spammer_1"},
    }
    assert (await consumer.process_message_body(json.dumps(follow_created))).status == "processed"
    assert (await consumer.process_message_body(json.dumps(block_created))).status == "processed"


async def test_store_follow_updates_store_affinity_and_product_recommendations_only_with_consent(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    await consumer.process_message_body(
        json.dumps(
            {
                "id": "evt_store_follow_consent",
                "type": "consent.granted",
                "source": "privacy",
                "subject": "follower_consented",
                "schemaVersion": 1,
                "occurredAt": reference_now.isoformat(),
                "data": {"consentType": "personalization"},
            }
        )
    )
    store_follow = {
        "id": "evt_store_follow",
        "type": "store.followed",
        "source": "catalog",
        "subject": "store_follow_1",
        "schemaVersion": 1,
        "occurredAt": reference_now.isoformat(),
        "data": {"storeId": "store_followed", "followerId": "follower_consented"},
    }
    assert (await consumer.process_message_body(json.dumps(store_follow))).status == "processed"

    followed_viewer_id = consumer.identifier_hasher.hash_user_id("follower_consented")
    followed_features = await application_container.feature_store.read_viewer_online_features(
        followed_viewer_id, ["store_followed", "store_other"], [], [], reference_now
    )
    assert followed_features.account_affinity_by_account["store_followed"] > 0
    followed_recommendations = await application_container.product_recommendation_service.recommend_products(
        ProductRecommendationRequest.model_validate(
            {
                "surface": "for_you",
                "viewer": {"userId": followed_viewer_id, "country": "NG"},
                "personalizationAllowed": True,
                "requestId": "store-follow-consented",
                "now": reference_now.isoformat(),
                "candidates": [
                    {"productId": "followed_product", "storeId": "store_followed"},
                    {"productId": "other_product", "storeId": "store_other"},
                ],
            }
        )
    )
    assert followed_recommendations.items[0].item_id == "followed_product"

    await consumer.process_message_body(
        json.dumps(
            {
                "id": "evt_store_follow_optout",
                "type": "consent.withdrawn",
                "source": "privacy",
                "subject": "follower_opted_out",
                "schemaVersion": 1,
                "occurredAt": reference_now.isoformat(),
                "data": {"consentType": "personalization"},
            }
        )
    )
    opted_out_follow = {
        **store_follow,
        "id": "evt_store_follow_opted_out",
        "data": {"storeId": "store_followed", "followerId": "follower_opted_out"},
    }
    assert (await consumer.process_message_body(json.dumps(opted_out_follow))).status == "processed"

    opted_out_viewer_id = consumer.identifier_hasher.hash_user_id("follower_opted_out")
    opted_out_features = await application_container.feature_store.read_viewer_online_features(
        opted_out_viewer_id, ["store_followed", "store_other"], [], [], reference_now
    )
    assert opted_out_features.account_affinity_by_account == {}
    opted_out_recommendations = await application_container.product_recommendation_service.recommend_products(
        ProductRecommendationRequest.model_validate(
            {
                "surface": "for_you",
                "viewer": {"userId": opted_out_viewer_id, "country": "NG"},
                "personalizationAllowed": True,
                "requestId": "store-follow-opted-out",
                "now": reference_now.isoformat(),
                "candidates": [
                    {"productId": "followed_product", "storeId": "store_followed"},
                    {"productId": "other_product", "storeId": "store_other"},
                ],
            }
        )
    )
    baseline_recommendations = await application_container.product_recommendation_service.recommend_products(
        ProductRecommendationRequest.model_validate(
            {
                "surface": "for_you",
                "viewer": {"userId": opted_out_viewer_id, "country": "NG"},
                "personalizationAllowed": False,
                "requestId": "store-follow-opted-out",
                "now": reference_now.isoformat(),
                "candidates": [
                    {"productId": "followed_product", "storeId": "store_followed"},
                    {"productId": "other_product", "storeId": "store_other"},
                ],
            }
        )
    )
    assert [item.item_id for item in opted_out_recommendations.items] == [
        item.item_id for item in baseline_recommendations.items
    ]


async def test_contract_report_and_message_envelopes_are_accepted(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    report_created = {
        "id": "evt_contract_report",
        "type": "report.created",
        "source": "social",
        "subject": "report_1",
        "schemaVersion": 1,
        "occurredAt": reference_now.isoformat(),
        "data": {
            "reportId": "report_1",
            "reporterId": "fan_2",
            "targetType": "post",
            "targetId": "post_2",
            "reportedUserId": "author_2",
            "reason": "fraud",
        },
    }
    message_sent = {
        "id": "evt_contract_message",
        "type": "message.sent",
        "source": "social",
        "subject": "conversation_1",
        "schemaVersion": 1,
        "occurredAt": reference_now.isoformat(),
        "data": {
            "messageId": "message_1",
            "senderId": "fan_2",
            "recipientIds": ["author_2"],
            "conversationId": "conversation_1",
            "kind": "text",
        },
    }
    assert (await consumer.process_message_body(json.dumps(report_created))).status == "processed"
    assert (await consumer.process_message_body(json.dumps(message_sent))).status == "processed"
