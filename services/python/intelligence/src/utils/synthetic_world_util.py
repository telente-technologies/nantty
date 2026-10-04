import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta

import numpy as np

SYNTHETIC_TOPICS: tuple[str, ...] = (
    "fashion",
    "food",
    "tech",
    "beauty",
    "music",
    "football",
    "home_decor",
    "comedy",
)
SYNTHETIC_COUNTRIES: tuple[str, ...] = ("NG", "NG", "NG", "NG", "GH", "KE")


@dataclass
class SyntheticUser:
    user_id: str
    country: str
    topic_preferences: dict[str, float]
    chosen_topics: list[str]
    followed_account_ids: set[str] = field(default_factory=set)


@dataclass
class SyntheticPost:
    post_id: str
    author_id: str
    store_id: str | None
    product_id: str | None
    topic: str
    quality: float
    created_at: datetime
    country: str
    like_count: int = 0
    comment_count: int = 0
    share_count: int = 0
    view_count: int = 0


@dataclass
class SyntheticClip:
    clip_id: str
    creator_id: str
    topic: str
    quality: float
    duration_ms: int
    created_at: datetime
    view_count: int = 0
    completion_count: int = 0
    rewatch_count: int = 0


@dataclass
class SyntheticWorld:
    users: list[SyntheticUser]
    posts: list[SyntheticPost]
    clips: list[SyntheticClip]
    store_topics: dict[str, str]
    product_prices_minor: dict[str, int]
    product_topics: dict[str, str]


def calculate_logistic_probability(logit: float) -> float:
    return 1.0 / (1.0 + math.exp(-logit))


def calculate_user_interest(user: SyntheticUser, topic: str) -> float:
    return user.topic_preferences[topic] * len(SYNTHETIC_TOPICS)


def build_synthetic_world(
    random_generator: np.random.Generator, user_count: int, window_end: datetime, window_days: int
) -> SyntheticWorld:
    window_start = window_end - timedelta(days=window_days)
    users: list[SyntheticUser] = []
    for user_index in range(user_count):
        preference_values = random_generator.dirichlet(np.full(len(SYNTHETIC_TOPICS), 0.4))
        preferences = dict(zip(SYNTHETIC_TOPICS, preference_values.tolist(), strict=True))
        chosen_topics = [topic for topic, _value in sorted(preferences.items(), key=lambda pair: -pair[1])[:2]]
        country = SYNTHETIC_COUNTRIES[int(random_generator.integers(len(SYNTHETIC_COUNTRIES)))]
        users.append(SyntheticUser(f"user_{user_index:04d}", country, preferences, chosen_topics))
    creator_topics = {f"creator_{index:03d}": SYNTHETIC_TOPICS[index % len(SYNTHETIC_TOPICS)] for index in range(16)}
    store_topics = {f"store_{index:03d}": SYNTHETIC_TOPICS[(index * 3) % len(SYNTHETIC_TOPICS)] for index in range(10)}
    product_topics: dict[str, str] = {}
    product_prices_minor: dict[str, int] = {}
    product_store: dict[str, str] = {}
    for product_index in range(60):
        store_id = f"store_{product_index % 10:03d}"
        product_id = f"product_{product_index:04d}"
        product_topics[product_id] = store_topics[store_id]
        product_prices_minor[product_id] = int(random_generator.integers(2_000, 80_000)) * 100
        product_store[product_id] = store_id
    window_seconds = (window_end - window_start).total_seconds()
    posts: list[SyntheticPost] = []
    for post_index in range(220):
        created_at = window_start + timedelta(seconds=float(random_generator.uniform(0, window_seconds * 0.9)))
        quality = float(random_generator.beta(2.0, 2.0))
        country = SYNTHETIC_COUNTRIES[int(random_generator.integers(len(SYNTHETIC_COUNTRIES)))]
        if post_index % 4 == 0:
            product_id = f"product_{int(random_generator.integers(60)):04d}"
            store_id = product_store[product_id]
            posts.append(
                SyntheticPost(
                    f"post_{post_index:05d}",
                    store_id,
                    store_id,
                    product_id,
                    product_topics[product_id],
                    quality,
                    created_at,
                    country,
                )
            )
            continue
        creator_id = f"creator_{int(random_generator.integers(16)):03d}"
        posts.append(
            SyntheticPost(
                f"post_{post_index:05d}",
                creator_id,
                None,
                None,
                creator_topics[creator_id],
                quality,
                created_at,
                country,
            )
        )
    clips = [
        SyntheticClip(
            clip_id=f"clip_{clip_index:05d}",
            creator_id=f"creator_{clip_index % 16:03d}",
            topic=creator_topics[f"creator_{clip_index % 16:03d}"],
            quality=float(random_generator.beta(2.0, 2.0)),
            duration_ms=int(random_generator.integers(6_000, 60_000)),
            created_at=window_start + timedelta(seconds=float(random_generator.uniform(0, window_seconds * 0.9))),
        )
        for clip_index in range(90)
    ]
    return SyntheticWorld(users, posts, clips, store_topics, product_prices_minor, product_topics)
