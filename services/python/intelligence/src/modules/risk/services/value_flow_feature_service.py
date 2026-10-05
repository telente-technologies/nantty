import math
from dataclasses import dataclass
from datetime import datetime

from src.events.event_envelope_dto import CoinTransferredEvent, GiftSentEvent, IntelligenceEvent
from src.interfaces.feature_backend_interface import FeatureBackendUnavailableError, FeatureWriteOperation
from src.repositories.online_feature_keyspace_repository import VALUE_FLOW_HALF_LIFE_SECONDS, OnlineFeatureKeyspace
from src.repositories.online_feature_repository import OnlineFeatureStore, build_forward_decayed_increment_operations

OUTGOING_FLOW = "out"
INCOMING_FLOW = "in"
FLOW_COUNTERPARTY_READ_LIMIT = 100
MINIMUM_COUNTED_FLOW_WEIGHT = 0.05


@dataclass(frozen=True, slots=True)
class ValueFlowSignals:
    counterparty_previously_sent_to_actor: bool = False
    counterparty_distinct_incoming_sources: int = 0
    actor_distinct_incoming_sources: int = 0
    available: bool = False


def build_value_flow_operations(
    event: IntelligenceEvent, keyspace: OnlineFeatureKeyspace
) -> list[FeatureWriteOperation]:
    event_time = event.occurred_at.timestamp()
    match event:
        case CoinTransferredEvent():
            counterparty, weight = event.payload.recipient_id, math.log1p(event.payload.coin_amount)
        case GiftSentEvent():
            counterparty, weight = event.payload.creator_id, math.log1p(event.payload.coin_amount)
        case _:
            return []
    if counterparty == event.actor_id:
        return []
    return [
        *build_forward_decayed_increment_operations(
            keyspace.value_flow_base_key(OUTGOING_FLOW, event.actor_id),
            counterparty,
            weight,
            event_time,
            VALUE_FLOW_HALF_LIFE_SECONDS,
        ),
        *build_forward_decayed_increment_operations(
            keyspace.value_flow_base_key(INCOMING_FLOW, counterparty),
            event.actor_id,
            weight,
            event_time,
            VALUE_FLOW_HALF_LIFE_SECONDS,
        ),
    ]


async def count_active_counterparties(
    store: OnlineFeatureStore, flow_direction: str, account_id: str, now: datetime
) -> list[tuple[str, float]]:
    rows = await store.read_decayed_highest_members(
        store.keyspace.value_flow_base_key(flow_direction, account_id),
        FLOW_COUNTERPARTY_READ_LIMIT,
        VALUE_FLOW_HALF_LIFE_SECONDS,
        now.timestamp(),
    )
    return [(member, weight) for member, weight in rows if weight >= MINIMUM_COUNTED_FLOW_WEIGHT]


async def read_value_flow_signals(
    store: OnlineFeatureStore | None, actor_id: str, counterparty_id: str | None, now: datetime
) -> ValueFlowSignals:
    if store is None:
        return ValueFlowSignals()
    try:
        actor_incoming = await count_active_counterparties(store, INCOMING_FLOW, actor_id, now)
        if counterparty_id is None:
            return ValueFlowSignals(
                actor_distinct_incoming_sources=len(actor_incoming),
                available=True,
            )
        counterparty_outgoing = await store.read_decayed_member_scores(
            store.keyspace.value_flow_base_key(OUTGOING_FLOW, counterparty_id),
            [actor_id],
            VALUE_FLOW_HALF_LIFE_SECONDS,
            now.timestamp(),
        )
        counterparty_incoming = await count_active_counterparties(store, INCOMING_FLOW, counterparty_id, now)
    except FeatureBackendUnavailableError:
        return ValueFlowSignals()
    return ValueFlowSignals(
        counterparty_previously_sent_to_actor=counterparty_outgoing.get(actor_id, 0.0) >= MINIMUM_COUNTED_FLOW_WEIGHT,
        counterparty_distinct_incoming_sources=len(counterparty_incoming),
        actor_distinct_incoming_sources=len(actor_incoming),
        available=True,
    )
