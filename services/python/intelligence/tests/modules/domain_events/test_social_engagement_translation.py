import hashlib
import hmac
import json
import time
from datetime import datetime
from typing import Any

from src.container import ApplicationContainer
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.events.domain_event_dto import GiftSentDomainEvent, domain_event_type_adapter
from src.modules.domain_events.services.domain_event_translation_service import translate_to_intelligence_event
from src.repositories.online_feature_keyspace_repository import ACCOUNT_AFFINITY_KIND, AFFINITY_HALF_LIFE_SECONDS
from src.services.identifier_hashing_service import (
    OpaqueIdentifierHasher,
    derive_identifier_hash_key,
    is_hashed_user_id,
)
from src.utils.decay_math_util import find_forward_decay_generation


def envelope(event_id: str, event_type: str, data: dict[str, Any], occurred_at: datetime) -> str:
    return json.dumps(
        {
            "id": event_id,
            "type": event_type,
            "source": "social",
            "subject": "subject_1",
            "schemaVersion": 1,
            "occurredAt": occurred_at.isoformat(),
            "data": data,
        }
    )


def hasher_of(container: ApplicationContainer) -> OpaqueIdentifierHasher:
    return container.domain_event_consumer_service.identifier_hasher


async def item_statistics(container: ApplicationContainer, item_id: str) -> dict[str, float]:
    keyspace = container.feature_store.keyspace
    return (await container.feature_backend.read_hash_fields([keyspace.item_statistics_key(item_id)]))[0]


async def account_affinity(container: ApplicationContainer, actor_id: str) -> list[str]:
    generation = find_forward_decay_generation(time.time(), AFFINITY_HALF_LIFE_SECONDS).generation_index
    base = container.feature_store.keyspace.affinity_base_key(ACCOUNT_AFFINITY_KIND, actor_id)
    rows = await container.feature_backend.read_sorted_set_highest_members([f"{base}:g{generation}"], 10)
    return [member for member, _score in rows[0]]


def test_hasher_matches_the_shared_algorithm_and_is_idempotent() -> None:
    key = derive_identifier_hash_key("", "s" * 32)
    expected_key = hmac.new(b"s" * 32, b"nantty:intelligence:user-id-hash", hashlib.sha256).digest()
    assert key == expected_key
    hasher = OpaqueIdentifierHasher(key)
    expected = "u_" + hmac.new(key, b"user:account-1", hashlib.sha256).hexdigest()[:40]
    assert hasher.hash_user_id("account-1") == expected
    assert hasher.hash_user_id(expected) == expected
    assert is_hashed_user_id(expected)
    assert not is_hashed_user_id("account-1")
    assert hasher.hash_search_query("  Red   SHOES ") == hasher.hash_search_query("red shoes")
    assert derive_identifier_hash_key("dedicated", "s" * 32) == b"dedicated"


async def test_post_like_feeds_hashed_affinity_and_item_statistics(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    body = envelope(
        "evt_like_1", "post.liked", {"postId": "post_1", "authorId": "author_1", "likedBy": "fan_1"}, reference_now
    )
    assert (await consumer.process_message_body(body)).status == "processed"
    hasher = hasher_of(application_container)
    assert await account_affinity(application_container, hasher.hash_user_id("fan_1")) == [
        hasher.hash_user_id("author_1")
    ]
    assert await account_affinity(application_container, "fan_1") == []
    assert (await item_statistics(application_container, "post_1"))["likes"] == 1.0


async def test_share_save_and_view_are_translated(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    bodies = [
        envelope(
            "evt_share_1",
            "post.shared",
            {"postId": "post_2", "authorId": "author_2", "sharedBy": "fan_2", "channel": "whatsapp"},
            reference_now,
        ),
        envelope(
            "evt_save_1",
            "content.saved",
            {
                "actorId": "fan_2",
                "targetType": "post",
                "targetId": "post_2",
                "postId": "post_2",
                "postAuthorId": "author_2",
                "kind": "post",
                "topics": [],
                "hashtags": [],
            },
            reference_now,
        ),
        envelope(
            "evt_view_1",
            "post.viewed",
            {"postId": "post_2", "authorId": "author_2", "viewerId": "fan_2", "dwellMs": 9000},
            reference_now,
        ),
    ]
    for body in bodies:
        assert (await consumer.process_message_body(body)).status == "processed"
    statistics = await item_statistics(application_container, "post_2")
    assert (statistics["shares"], statistics["saves"], statistics["views"], statistics["long_dwells"]) == (
        1.0,
        1.0,
        1.0,
        1.0,
    )
    keyspace = application_container.feature_store.keyspace
    seen_key = keyspace.recently_seen_items_key(hasher_of(application_container).hash_user_id("fan_2"))
    seen = await application_container.feature_backend.read_sorted_set_highest_members([seen_key], 5)
    assert [member for member, _score in seen[0]] == ["post_2"]


async def test_comment_fan_out_counts_once_and_unknown_post_author_is_skipped(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    base = {"commentId": "comment_1", "postId": "post_3", "authorId": "commenter_1"}
    to_post_author = envelope(
        "evt_c_post", "comment.created", {**base, "recipientUserId": "author_3", "target": "post"}, reference_now
    )
    to_parent_author = envelope(
        "evt_c_reply",
        "comment.created",
        {**base, "recipientUserId": "parent_1", "target": "reply", "postAuthorId": "author_3"},
        reference_now,
    )
    assert (await consumer.process_message_body(to_post_author)).status == "processed"
    assert (await consumer.process_message_body(to_parent_author)).status == "duplicate"
    assert (await item_statistics(application_container, "post_3"))["comments"] == 1.0
    reply_only = envelope(
        "evt_c_reply_only",
        "comment.created",
        {**base, "commentId": "comment_2", "postId": "post_4", "recipientUserId": "parent_2", "target": "reply"},
        reference_now,
    )
    assert (await consumer.process_message_body(reply_only)).status == "processed"
    assert await item_statistics(application_container, "post_4") == {}


async def test_opted_out_actor_gets_no_engagement_features(
    application_container: ApplicationContainer, feature_backend: InMemoryFeatureBackend, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    withdrawn = envelope(
        "evt_optout", "consent.withdrawn", {"accountId": "fan_9", "consentType": "personalization"}, reference_now
    )
    assert (await consumer.process_message_body(withdrawn)).status == "processed"
    liked = envelope(
        "evt_like_9", "post.liked", {"postId": "post_9", "authorId": "a_9", "likedBy": "fan_9"}, reference_now
    )
    assert (await consumer.process_message_body(liked)).status == "processed"
    assert await item_statistics(application_container, "post_9") == {}
    assert not await application_container.feature_store.is_personalization_allowed(
        hasher_of(application_container).hash_user_id("fan_9")
    )


def test_gift_events_keep_raw_ids_for_the_value_flow_graph(reference_now: datetime) -> None:
    hasher = OpaqueIdentifierHasher(b"k" * 32)
    event = domain_event_type_adapter.validate_python(
        {
            "eventId": "evt_gift",
            "eventType": "gift.sent",
            "occurredAt": reference_now.isoformat(),
            "actorId": "sender_1",
            "payload": {"giftId": "g1", "creatorId": "creator_1", "coinAmount": 5},
        }
    )
    assert isinstance(event, GiftSentDomainEvent)
    translated = translate_to_intelligence_event(event, False, hasher)
    assert translated is not None
    assert translated["actorId"] == "sender_1"
    assert translated["payload"]["creatorId"] == "creator_1"
