import json
import time
from datetime import datetime
from typing import Any

from src.container import ApplicationContainer
from src.databases.in_memory_feature_database import InMemoryFeatureBackend
from src.repositories.online_feature_keyspace_repository import AFFINITY_HALF_LIFE_SECONDS, TOPIC_AFFINITY_KIND
from src.utils.decay_math_util import find_forward_decay_generation

__all__ = ["domain_event", "product_viewed", "hashed", "read_topic_affinity"]


def domain_event(event_id: str, event_type: str, actor_id: str, occurred_at: datetime, payload: dict[str, Any]) -> str:
    return json.dumps(
        {
            "eventId": event_id,
            "eventType": event_type,
            "occurredAt": occurred_at.isoformat(),
            "actorId": actor_id,
            "payload": payload,
        }
    )


def product_viewed(event_id: str, actor_id: str, occurred_at: datetime) -> str:
    return domain_event(
        event_id, "product.viewed", actor_id, occurred_at, {"productId": "p1", "storeId": "s1", "topics": ["fashion"]}
    )


def hashed(container: ApplicationContainer, user_id: str) -> str:
    return container.domain_event_consumer_service.identifier_hasher.hash_user_id(user_id)


async def read_topic_affinity(backend: InMemoryFeatureBackend, container: ApplicationContainer, user_id: str) -> int:
    generation = find_forward_decay_generation(time.time(), AFFINITY_HALF_LIFE_SECONDS).generation_index
    base = container.feature_store.keyspace.affinity_base_key(TOPIC_AFFINITY_KIND, hashed(container, user_id))
    rows = await backend.read_sorted_set_highest_members([f"{base}:g{generation}"], 10)
    return len(rows[0])
