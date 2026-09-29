from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class ViewerOnlineFeatures:
    topic_affinity_by_topic: dict[str, float] = field(default_factory=dict)
    account_affinity_by_account: dict[str, float] = field(default_factory=dict)
    item_statistics_by_item: dict[str, dict[str, float]] = field(default_factory=dict)
    recently_seen_item_ids: frozenset[str] = frozenset()
