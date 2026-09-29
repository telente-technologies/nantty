import math
from datetime import datetime, timedelta
from typing import Any

import numpy as np

from src.container import ApplicationContainer
from src.modules.clips.dtos.clip_ranking_dto import ClipRankingRequest
from src.modules.feed.dtos.feed_ranking_dto import FeedRankingRequest
from src.utils.synthetic_world_util import (
    SyntheticUser,
    SyntheticWorld,
    calculate_logistic_probability,
    calculate_user_interest,
)

type EventDictionary = dict[str, Any]


class SyntheticEventRecorder:
    def __init__(self) -> None:
        self.events: list[EventDictionary] = []
        self.sequence_number = 0

    def record(
        self, event_type: str, user: SyntheticUser, occurred_at: datetime, payload: dict[str, Any], **context: Any
    ) -> None:
        self.sequence_number += 1
        self.events.append(
            {
                "eventId": f"synthetic_{self.sequence_number:08d}",
                "eventType": event_type,
                "occurredAt": occurred_at.isoformat(),
                "actorId": user.user_id,
                "country": user.country,
                "context": {key: value for key, value in context.items() if value is not None},
                "payload": payload,
            }
        )


def draw_probability(random_generator: np.random.Generator, probability: float) -> bool:
    return bool(random_generator.random() < probability)


async def simulate_feed_session(
    container: ApplicationContainer,
    world: SyntheticWorld,
    user: SyntheticUser,
    session_time: datetime,
    random_generator: np.random.Generator,
    recorder: SyntheticEventRecorder,
) -> list[str]:
    available_posts = [post for post in world.posts if post.created_at <= session_time]
    if len(available_posts) < 10:
        return []
    sample_indices = random_generator.choice(len(available_posts), size=min(120, len(available_posts)), replace=False)
    posts_by_id = {available_posts[int(index)].post_id: available_posts[int(index)] for index in sample_indices}
    request = FeedRankingRequest.model_validate(
        {
            "viewer": {
                "userId": user.user_id,
                "country": user.country,
                "chosenTopics": user.chosen_topics,
                "followedAccountIds": sorted(user.followed_account_ids),
            },
            "candidates": [
                {
                    "itemId": post.post_id,
                    "authorId": post.author_id,
                    "storeId": post.store_id,
                    "contentKind": "product" if post.product_id else "personal",
                    "createdAt": post.created_at.isoformat(),
                    "topics": [post.topic],
                    "likeCount": post.like_count,
                    "commentCount": post.comment_count,
                    "shareCount": post.share_count,
                    "viewCount": post.view_count,
                    "country": post.country,
                }
                for post in posts_by_id.values()
            ],
            "limit": 12,
            "now": session_time.isoformat(),
        }
    )
    response = await container.feed_ranking_service.rank_feed(request)
    shown_post_ids: list[str] = []
    for offset, ranked_item in enumerate(response.items):
        post = posts_by_id[ranked_item.item_id]
        shown_post_ids.append(post.post_id)
        moment = session_time + timedelta(seconds=5 * offset + 1)
        interest = calculate_user_interest(user, post.topic)
        follows = 1.0 if post.author_id in user.followed_account_ids else 0.0
        base_payload = {"postId": post.post_id, "authorId": post.author_id, "topics": [post.topic]}
        dwell_ms = int(
            min(
                float(random_generator.lognormal(math.log(2500 * (0.4 + interest) * (0.5 + post.quality)), 0.6)),
                600_000,
            )
        )
        post.view_count += 1
        context = {"surface": "feed_for_you", "rankingRequestId": response.metadata.request_id}
        recorder.record(
            "post_viewed", user, moment, {**base_payload, "dwellMs": dwell_ms, "position": offset}, **context
        )
        if draw_probability(
            random_generator, calculate_logistic_probability(-3.0 + 1.5 * interest + 2 * post.quality + follows)
        ):
            post.like_count += 1
            recorder.record("post_liked", user, moment + timedelta(seconds=1), base_payload, **context)
        if draw_probability(
            random_generator, calculate_logistic_probability(-4.5 + 1.2 * interest + 1.5 * post.quality)
        ):
            post.comment_count += 1
            recorder.record("commented", user, moment + timedelta(seconds=2), base_payload, **context)
        if draw_probability(random_generator, calculate_logistic_probability(-5.0 + 1.2 * interest + 2 * post.quality)):
            post.share_count += 1
            recorder.record("shared", user, moment + timedelta(seconds=3), base_payload, **context)
        if (
            post.product_id
            and post.store_id
            and draw_probability(random_generator, calculate_logistic_probability(-2.5 + 1.5 * interest + post.quality))
        ):
            simulate_product_funnel(
                world, user, post.product_id, post.store_id, post.post_id, moment, random_generator, recorder
            )
        if not follows and draw_probability(random_generator, calculate_logistic_probability(-5.0 + 1.5 * interest)):
            user.followed_account_ids.add(post.author_id)
            recorder.record(
                "followed",
                user,
                moment + timedelta(seconds=4),
                {"targetAccountId": post.author_id, "targetKind": "user"},
            )
    return shown_post_ids


def simulate_product_funnel(
    world: SyntheticWorld,
    user: SyntheticUser,
    product_id: str,
    store_id: str,
    source_post_id: str | None,
    moment: datetime,
    random_generator: np.random.Generator,
    recorder: SyntheticEventRecorder,
) -> None:
    price = {"amountMinor": world.product_prices_minor[product_id], "currency": "NGN"}
    topics = [world.product_topics[product_id]]
    recorder.record(
        "product_viewed",
        user,
        moment + timedelta(seconds=2),
        {
            "productId": product_id,
            "storeId": store_id,
            "sourcePostId": source_post_id,
            "topics": topics,
            "price": price,
        },
    )
    if not draw_probability(random_generator, 0.35):
        return
    recorder.record(
        "added_to_cart",
        user,
        moment + timedelta(seconds=20),
        {"productId": product_id, "storeId": store_id, "quantity": 1, "sourcePostId": source_post_id},
    )
    if not draw_probability(random_generator, 0.45):
        return
    extra_product = f"product_{(int(product_id.split('_')[1]) + 10) % 60:04d}"
    items = [{"productId": product_id, "quantity": 1, "unitPrice": price}]
    if draw_probability(random_generator, 0.4):
        extra_price = {"amountMinor": world.product_prices_minor[extra_product], "currency": "NGN"}
        items.append({"productId": extra_product, "quantity": 1, "unitPrice": extra_price})
    recorder.record(
        "purchased",
        user,
        moment + timedelta(seconds=90),
        {
            "orderId": f"order_{recorder.sequence_number:08d}",
            "storeId": store_id,
            "items": items,
            "sourcePostId": source_post_id,
        },
    )


async def simulate_clip_session(
    container: ApplicationContainer,
    world: SyntheticWorld,
    user: SyntheticUser,
    session_time: datetime,
    random_generator: np.random.Generator,
    recorder: SyntheticEventRecorder,
) -> None:
    available = [clip for clip in world.clips if clip.created_at <= session_time][:60]
    if len(available) < 5:
        return
    clips_by_id = {clip.clip_id: clip for clip in available}
    request = ClipRankingRequest.model_validate(
        {
            "viewer": {"userId": user.user_id, "country": user.country, "chosenTopics": user.chosen_topics},
            "candidates": [
                {
                    "itemId": clip.clip_id,
                    "creatorId": clip.creator_id,
                    "createdAt": clip.created_at.isoformat(),
                    "durationMs": clip.duration_ms,
                    "topics": [clip.topic],
                    "viewCount": clip.view_count,
                    "completionCount": clip.completion_count,
                    "rewatchCount": clip.rewatch_count,
                }
                for clip in available
            ],
            "limit": 6,
            "now": session_time.isoformat(),
        }
    )
    response = await container.clip_ranking_service.rank_clips(request)
    for offset, ranked_item in enumerate(response.items):
        clip = clips_by_id[ranked_item.item_id]
        interest = calculate_user_interest(user, clip.topic)
        watch_fraction = float(random_generator.beta(0.6 + 2.5 * interest * (0.5 + clip.quality), 1.5))
        loops = int(
            watch_fraction > 0.9 and draw_probability(random_generator, calculate_logistic_probability(-2 + interest))
        )
        clip.view_count += 1
        clip.completion_count += int(watch_fraction >= 0.9)
        clip.rewatch_count += loops
        recorder.record(
            "clip_watched",
            user,
            session_time + timedelta(seconds=30 * offset + 2),
            {
                "clipId": clip.clip_id,
                "creatorId": clip.creator_id,
                "watchFraction": round(watch_fraction, 4),
                "loopCount": loops,
                "durationMs": clip.duration_ms,
                "topics": [clip.topic],
            },
            surface="clips",
            rankingRequestId=response.metadata.request_id,
        )
