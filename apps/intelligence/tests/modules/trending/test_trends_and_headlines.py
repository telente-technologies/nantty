from datetime import datetime, timedelta
from typing import Any

from src.container import ApplicationContainer
from src.modules.trending.dtos.headline_dto import HeadlineRequest
from src.modules.trending.dtos.trending_dto import TrendingRequest
from src.modules.trending.services.headline_clustering_service import build_headlines_from_posts
from tests.conftest import build_event


def build_like(
    index: int, actor_id: str, now: datetime, hashtags: list[str], country: str, **context: Any
) -> dict[str, Any]:
    payload = {"postId": f"post_{hashtags[0]}_{index % 3}", "authorId": "author_1", "topics": [], "hashtags": hashtags}
    envelope: dict[str, Any] = {"country": country}
    if context:
        envelope["context"] = context
    return build_event(f"evt_{hashtags[0]}_{country}_{index}", "post_liked", actor_id, now, payload, **envelope)


async def ingest(container: ApplicationContainer, events: list[dict[str, Any]]) -> None:
    response = await container.event_ingestion_service.ingest_event_batch(events)
    assert response.accepted == len(events)


async def read_hashtags(container: ApplicationContainer, now: datetime, **filters: Any) -> list[str]:
    response = await container.trending_service.read_trending(
        TrendingRequest(kind="hashtag", now=now, minimum_distinct_actors=3, **filters)
    )
    return [item.item_id for item in response.items]


async def test_trends_are_scoped_per_country_and_category(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    events = [build_like(index, f"ng_{index}", reference_now, ["afrobeats"], "NG") for index in range(8)]
    events += [build_like(index, f"gh_{index}", reference_now, ["blackstars"], "GH") for index in range(8)]
    events += [build_like(index, f"ng_sport_{index}", reference_now, ["supereagles"], "NG") for index in range(6)]
    await ingest(application_container, events)
    nigeria = await read_hashtags(application_container, reference_now, country="NG")
    ghana = await read_hashtags(application_container, reference_now, country="GH")
    nigeria_music = await read_hashtags(application_container, reference_now, country="NG", category="music")
    nigeria_sports = await read_hashtags(application_container, reference_now, country="NG", category="sports")
    assert set(nigeria) == {"afrobeats", "supereagles"}
    assert ghana == ["blackstars"]
    assert nigeria_music == ["afrobeats"]
    assert nigeria_sports == ["supereagles"]


async def test_coordinated_cluster_engagement_is_excluded_from_trending(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    ring = [
        build_like(index, f"bot_{index}", reference_now, ["buyournewphone"], "NG", actorClusterKey="ip_cluster_1")
        for index in range(15)
    ]
    honest = [build_like(index, f"fan_{index}", reference_now, ["jollof"], "NG") for index in range(6)]
    await ingest(application_container, ring + honest)
    response = await application_container.trending_service.read_trending(
        TrendingRequest(kind="hashtag", country="NG", now=reference_now, minimum_distinct_actors=3)
    )
    assert [item.item_id for item in response.items] == ["jollof"]
    assert "buyournewphone" in response.manipulated_ids


async def test_new_accounts_and_spammy_hashtags_cannot_trend(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    fresh = [
        build_like(index, f"new_{index}", reference_now, ["giveawaynow"], "NG", actorTrust="new") for index in range(12)
    ]
    spam = [build_like(index, f"user_{index}", reference_now, ["follow4follow"], "NG") for index in range(12)]
    await ingest(application_container, fresh + spam)
    trends = await read_hashtags(application_container, reference_now, country="NG")
    assert "follow4follow" not in trends
    assert "giveawaynow" not in trends


async def test_actor_velocity_cap_limits_one_account_flooding_many_posts(
    application_container: ApplicationContainer, reference_now: datetime
) -> None:
    flood = [
        build_event(
            f"flood_{index}",
            "post_liked",
            "one_bot",
            reference_now,
            {"postId": f"flood_post_{index}", "authorId": "author_x", "topics": [], "hashtags": ["floodtag"]},
            country="NG",
        )
        for index in range(100)
    ]
    await ingest(application_container, flood)
    keyspace = application_container.feature_store.keyspace
    rows = await application_container.feature_store.feature_backend.read_hash_fields(
        [keyspace.item_statistics_key(f"flood_post_{index}") for index in (0, 99)]
    )
    assert rows[0].get("integrity_engagements") == 1.0
    assert rows[1].get("integrity_engagements") is None


def build_headline_post(index: int, now: datetime, **overrides: Any) -> dict[str, Any]:
    return {
        "postId": f"hp_{index}",
        "authorId": f"author_{index}",
        "text": "Lagos Fashion Week opened tonight with a stunning ankara collection",
        "hashtags": ["lagosfashionweek"],
        "createdAt": (now - timedelta(hours=1)).isoformat(),
        "likeCount": 40,
        "viewCount": 500,
        **overrides,
    }


def test_headlines_cluster_public_posts_and_exclude_sensitive_content(reference_now: datetime) -> None:
    posts = [build_headline_post(index, reference_now) for index in range(4)]
    posts.append(build_headline_post(10, reference_now, isSensitive=True, text="graphic sensitive post"))
    posts.append(build_headline_post(11, reference_now, ageRestricted=True))
    response = build_headlines_from_posts(
        HeadlineRequest.model_validate({"posts": posts, "now": reference_now.isoformat()})
    )
    assert len(response.headlines) == 1
    headline = response.headlines[0]
    assert headline.source_label == "Summarised from posts"
    assert headline.category == "fashion"
    assert headline.generated_by == "extractive_v1"
    assert "hp_10" not in headline.post_ids and "hp_11" not in headline.post_ids
    assert headline.title.startswith("Lagos Fashion Week opened tonight")
    assert headline.post_count == 4


def test_headlines_need_several_authors_and_skip_manipulated_posts(reference_now: datetime) -> None:
    one_author = [build_headline_post(index, reference_now, authorId="same_author") for index in range(6)]
    manipulated = [
        build_headline_post(20 + index, reference_now, integrity={"engagerCount": 100, "clusteredEngagerShare": 0.9})
        for index in range(6)
    ]
    response = build_headlines_from_posts(
        HeadlineRequest.model_validate({"posts": one_author + manipulated, "now": reference_now.isoformat()})
    )
    assert response.headlines == []


def test_political_headlines_use_the_neutral_template(reference_now: datetime) -> None:
    posts = [
        build_headline_post(index, reference_now, hashtags=["election2027"], text="THE OTHER PARTY IS EVIL!!!")
        for index in range(4)
    ]
    response = build_headlines_from_posts(
        HeadlineRequest.model_validate({"posts": posts, "now": reference_now.isoformat()})
    )
    assert response.headlines[0].title == "People are posting about #election2027"
    assert response.headlines[0].generated_by == "template_v1"


def test_removed_stories_are_not_returned(reference_now: datetime) -> None:
    posts = [build_headline_post(index, reference_now) for index in range(4)]
    response = build_headlines_from_posts(
        HeadlineRequest.model_validate(
            {"posts": posts, "now": reference_now.isoformat(), "excludedStoryKeys": ["lagosfashionweek"]}
        )
    )
    assert response.headlines == []
