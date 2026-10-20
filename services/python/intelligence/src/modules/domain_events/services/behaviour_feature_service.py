from dataclasses import dataclass
from datetime import datetime, timedelta

from src.events.domain_event_dto import (
    AccountRegisteredDomainEvent,
    BlockCreatedDomainEvent,
    DomainEvent,
    FollowCreatedDomainEvent,
    LoggedInDomainEvent,
    MessageSentDomainEvent,
    PostCreatedDomainEvent,
    ReportCreatedDomainEvent,
)
from src.interfaces.feature_backend_interface import (
    DistinctMemberAdd,
    FeatureBackend,
    FeatureWriteOperation,
    HashFieldAssign,
    HashFieldIncrement,
    KeyExpiry,
)
from src.repositories.online_feature_keyspace_repository import (
    ACCOUNT_PROFILE_TTL_SECONDS,
    BEHAVIOUR_COUNTER_TTL_SECONDS,
    OnlineFeatureKeyspace,
    format_utc_day_bucket,
)

PROFILE_CREATED_AT_FIELD = "created_at_unix"


@dataclass(frozen=True, slots=True)
class AccountBehaviourSnapshot:
    messages_sent: float = 0.0
    links_sent: float = 0.0
    reported_links: float = 0.0
    distinct_recipients: int = 0
    distinct_devices: int = 0
    distinct_ips: int = 0
    reports_received: float = 0.0
    blocks_received: float = 0.0
    posts_created: float = 0.0
    follows_made: float = 0.0
    logins: float = 0.0
    account_created_at_unix: float | None = None


def increment_counter(
    keyspace: OnlineFeatureKeyspace, account_id: str, day_bucket: str, field: str, amount: float = 1.0
) -> list[FeatureWriteOperation]:
    key = keyspace.behaviour_counter_key(account_id, day_bucket)
    return [HashFieldIncrement(key, field, amount), KeyExpiry(key, BEHAVIOUR_COUNTER_TTL_SECONDS)]


def add_distinct(
    keyspace: OnlineFeatureKeyspace, set_name: str, account_id: str, day_bucket: str, member: str | None
) -> list[FeatureWriteOperation]:
    if member is None:
        return []
    key = keyspace.behaviour_distinct_key(set_name, account_id, day_bucket)
    return [DistinctMemberAdd(key, member), KeyExpiry(key, BEHAVIOUR_COUNTER_TTL_SECONDS)]


def build_behaviour_operations(event: DomainEvent, keyspace: OnlineFeatureKeyspace) -> list[FeatureWriteOperation]:
    day = format_utc_day_bucket(event.occurred_at)
    actor = event.actor_id
    result: list[FeatureWriteOperation]
    match event:
        case MessageSentDomainEvent():
            payload = event.payload
            operations = increment_counter(keyspace, actor, day, "messages_sent")
            if payload.contains_link:
                operations += increment_counter(keyspace, actor, day, "links_sent")
            if payload.link_reported:
                operations += increment_counter(keyspace, actor, day, "reported_links")
            operations += add_distinct(keyspace, "recipients", actor, day, payload.recipient_id)
            operations += add_distinct(keyspace, "devices", actor, day, payload.device_id)
            result = operations + add_distinct(keyspace, "ips", actor, day, payload.ip_hash)
        case LoggedInDomainEvent():
            result = [
                *increment_counter(keyspace, actor, day, "logins"),
                *add_distinct(keyspace, "devices", actor, day, event.payload.device_id),
                *add_distinct(keyspace, "ips", actor, day, event.payload.ip_hash),
            ]
        case PostCreatedDomainEvent():
            result = increment_counter(keyspace, actor, day, "posts_created")
        case FollowCreatedDomainEvent():
            result = increment_counter(keyspace, actor, day, "follows_made")
        case ReportCreatedDomainEvent() if event.payload.target_author_id:
            result = increment_counter(keyspace, event.payload.target_author_id, day, "reports_received")
        case BlockCreatedDomainEvent():
            result = increment_counter(keyspace, event.payload.blocked_account_id, day, "blocks_received")
        case AccountRegisteredDomainEvent():
            profile_key = keyspace.account_profile_key(actor)
            result = [
                HashFieldAssign(profile_key, PROFILE_CREATED_AT_FIELD, event.occurred_at.timestamp()),
                KeyExpiry(profile_key, ACCOUNT_PROFILE_TTL_SECONDS),
            ]
        case _:
            result = []
    return result


def list_recent_day_buckets(now: datetime, day_count: int) -> list[str]:
    return [format_utc_day_bucket(now - timedelta(days=offset)) for offset in range(day_count)]


async def read_account_behaviour_snapshot(
    backend: FeatureBackend, keyspace: OnlineFeatureKeyspace, account_id: str, now: datetime, day_count: int = 1
) -> AccountBehaviourSnapshot:
    days = list_recent_day_buckets(now, day_count)
    counters = await backend.read_hash_fields(
        [keyspace.behaviour_counter_key(account_id, day) for day in days] + [keyspace.account_profile_key(account_id)]
    )
    profile = counters.pop()
    totals: dict[str, float] = {}
    for counter in counters:
        for field, value in counter.items():
            totals[field] = totals.get(field, 0.0) + value
    distinct_counts: dict[str, int] = {}
    for set_name in ("recipients", "devices", "ips"):
        keys = [keyspace.behaviour_distinct_key(set_name, account_id, day) for day in days]
        distinct_counts[set_name] = max(await backend.count_distinct_members(keys))
    return AccountBehaviourSnapshot(
        messages_sent=totals.get("messages_sent", 0.0),
        links_sent=totals.get("links_sent", 0.0),
        reported_links=totals.get("reported_links", 0.0),
        distinct_recipients=distinct_counts["recipients"],
        distinct_devices=distinct_counts["devices"],
        distinct_ips=distinct_counts["ips"],
        reports_received=totals.get("reports_received", 0.0),
        blocks_received=totals.get("blocks_received", 0.0),
        posts_created=totals.get("posts_created", 0.0),
        follows_made=totals.get("follows_made", 0.0),
        logins=totals.get("logins", 0.0),
        account_created_at_unix=profile.get(PROFILE_CREATED_AT_FIELD),
    )
