import json
import time
from datetime import datetime, timedelta
from typing import Any

from src.container import ApplicationContainer
from src.repositories.online_feature_keyspace_repository import (
    ACCOUNT_AFFINITY_KIND,
    AFFINITY_HALF_LIFE_SECONDS,
    TOPIC_AFFINITY_KIND,
)
from src.utils.decay_math_util import find_forward_decay_generation


def envelope(event_id: str, event_type: str, data: dict[str, Any], occurred_at: datetime) -> str:
    return json.dumps(
        {
            "id": event_id,
            "type": event_type,
            "source": "nantty.social",
            "subject": data.get("commentId", "subject"),
            "schemaVersion": 1,
            "occurredAt": occurred_at.isoformat(),
            "data": data,
        }
    )


def visibility(event_id: str, event_type: str, comment_id: str, at: datetime) -> str:
    data = {
        "commentId": comment_id,
        "postId": "post_h",
        "commentAuthorId": "commenter_h",
        "parentCommentId": None,
        "actorId": "author_h",
    }
    return envelope(event_id, event_type, data, at)


def created(comment_id: str, at: datetime) -> str:
    data = {
        "commentId": comment_id,
        "postId": "post_h",
        "authorId": "commenter_h",
        "recipientUserId": "author_h",
        "target": "post",
        "actor": {"id": "commenter_h", "name": "C"},
        "topics": ["fashion"],
    }
    return envelope(f"evt_{comment_id}", "comment.created", data, at)


async def affinity(container: ApplicationContainer, kind: str, member: str) -> float:
    hashed = container.domain_event_consumer_service.identifier_hasher.hash_user_id("commenter_h")
    generation = find_forward_decay_generation(time.time(), AFFINITY_HALF_LIFE_SECONDS).generation_index
    base = container.feature_store.keyspace.affinity_base_key(kind, hashed)
    scores = await container.feature_backend.read_sorted_set_member_scores([(f"{base}:g{generation}", [member])])
    return scores[0][0] or 0.0


async def comment_count(container: ApplicationContainer) -> float:
    key = container.feature_store.keyspace.item_statistics_key("post_h")
    return (await container.feature_backend.read_hash_fields([key]))[0].get("comments", 0.0)


async def test_hiding_reverses_and_unhiding_restores_the_comment_signal(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    author = consumer.identifier_hasher.hash_user_id("author_h")
    assert (await consumer.process_message_body(created("c_h1", reference_now))).status == "processed"
    account_before = await affinity(application_container, ACCOUNT_AFFINITY_KIND, author)
    topic_before = await affinity(application_container, TOPIC_AFFINITY_KIND, "fashion")
    assert account_before > 0
    assert topic_before > 0
    assert await comment_count(application_container) == 1.0

    later = reference_now + timedelta(minutes=5)
    hidden = visibility("evt_hide_1", "comment.hidden", "c_h1", later)
    assert (await consumer.process_message_body(hidden)).status == "processed"
    assert abs(await affinity(application_container, ACCOUNT_AFFINITY_KIND, author)) < 1e-9
    assert abs(await affinity(application_container, TOPIC_AFFINITY_KIND, "fashion")) < 1e-9
    assert await comment_count(application_container) == 0.0

    assert (await consumer.process_message_body(hidden)).status == "duplicate"
    second_hide = visibility("evt_hide_again", "comment.hidden", "c_h1", later)
    assert (await consumer.process_message_body(second_hide)).status == "processed"
    assert await comment_count(application_container) == 0.0

    unhidden = visibility("evt_unhide_1", "comment.unhidden", "c_h1", later + timedelta(minutes=1))
    assert (await consumer.process_message_body(unhidden)).status == "processed"
    assert abs(await affinity(application_container, ACCOUNT_AFFINITY_KIND, author) - account_before) < 1e-9
    assert abs(await affinity(application_container, TOPIC_AFFINITY_KIND, "fashion") - topic_before) < 1e-9
    assert await comment_count(application_container) == 1.0


async def test_hiding_a_comment_that_never_counted_changes_nothing(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    unknown = visibility("evt_hide_unknown", "comment.hidden", "c_never", reference_now)
    assert (await consumer.process_message_body(unknown)).status == "processed"
    assert await comment_count(application_container) == 0.0
    unhide_first = visibility("evt_unhide_unknown", "comment.unhidden", "c_never", reference_now)
    assert (await consumer.process_message_body(unhide_first)).status == "processed"
    assert await comment_count(application_container) == 0.0


async def test_unhide_before_any_hide_is_ignored(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    consumer = application_container.domain_event_consumer_service
    assert (await consumer.process_message_body(created("c_h2", reference_now))).status == "processed"
    early = visibility("evt_unhide_early", "comment.unhidden", "c_h2", reference_now)
    assert (await consumer.process_message_body(early)).status == "processed"
    assert await comment_count(application_container) == 1.0
