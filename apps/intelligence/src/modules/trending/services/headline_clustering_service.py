import math
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime

from src.dtos.common_dto import RankingResponseMetadata
from src.modules.trending.dtos.headline_dto import Headline, HeadlinePost, HeadlineRequest, HeadlineResponse
from src.modules.trending.services.headline_text_service import (
    build_extractive_headline_title,
    build_headline_summary,
)
from src.services.engagement_integrity_service import assess_engagement_integrity
from src.services.ranking_context_service import resolve_request_identifier, resolve_request_time
from src.services.trend_category_service import classify_trend_category, is_spammy_hashtag
from src.utils.decay_math_util import calculate_age_in_hours

MAXIMUM_POSTS_PER_HEADLINE = 10
HEADLINE_WINDOW_HOURS = 24


@dataclass(slots=True)
class StoryCluster:
    post_indices: list[int] = field(default_factory=list)
    hashtag_counts: Counter[str] = field(default_factory=Counter)


def find_root(parents: list[int], index: int) -> int:
    while parents[index] != index:
        parents[index] = parents[parents[index]]
        index = parents[index]
    return index


def is_post_eligible_for_headlines(post: HeadlinePost) -> bool:
    if post.is_sensitive or post.age_restricted or not post.is_public:
        return False
    return post.integrity is None or not assess_engagement_integrity(post.integrity).manipulated


def story_terms_for_post(post: HeadlinePost) -> list[str]:
    hashtags = [tag for tag in post.hashtags if not is_spammy_hashtag(tag)]
    return list(dict.fromkeys(hashtags or post.topics))


def cluster_posts_into_stories(posts: Sequence[HeadlinePost]) -> list[StoryCluster]:
    parents = list(range(len(posts)))
    first_post_by_term: dict[str, int] = {}
    for index, post in enumerate(posts):
        for term in story_terms_for_post(post):
            if term in first_post_by_term:
                parents[find_root(parents, index)] = find_root(parents, first_post_by_term[term])
            else:
                first_post_by_term[term] = index
    clusters: dict[int, StoryCluster] = {}
    for index, post in enumerate(posts):
        terms = story_terms_for_post(post)
        if not terms:
            continue
        cluster = clusters.setdefault(find_root(parents, index), StoryCluster())
        cluster.post_indices.append(index)
        cluster.hashtag_counts.update(terms)
    return list(clusters.values())


def calculate_post_velocity(post: HeadlinePost, now: datetime) -> float:
    trusted = 1.0 if post.integrity is None else assess_engagement_integrity(post.integrity).trusted_engagement_share
    interactions = post.like_count + 3 * post.comment_count + 4 * (post.repost_count + post.share_count)
    reach = max(post.view_count, interactions, 1)
    age_hours = max(calculate_age_in_hours(post.created_at, now), 0.5)
    return trusted * math.log1p(interactions) * (1.0 + interactions / reach) / math.sqrt(age_hours)


def build_headlines_from_posts(request: HeadlineRequest) -> HeadlineResponse:
    now = resolve_request_time(request.now)
    posts = [
        post
        for post in request.posts
        if is_post_eligible_for_headlines(post)
        and calculate_age_in_hours(post.created_at, now) <= HEADLINE_WINDOW_HOURS
    ]
    excluded_keys = frozenset(request.excluded_story_keys)
    scored: list[tuple[float, Headline]] = []
    for cluster in cluster_posts_into_stories(posts):
        members = [posts[index] for index in cluster.post_indices]
        author_ids = {post.author_id for post in members}
        if len(members) < request.minimum_posts_per_story or len(author_ids) < request.minimum_distinct_authors:
            continue
        ranked_terms = sorted(cluster.hashtag_counts.items(), key=lambda pair: (-pair[1], pair[0]))
        story_key = ranked_terms[0][0]
        if story_key in excluded_keys:
            continue
        category = classify_trend_category(story_key)
        if request.category is not None and category != request.category:
            continue
        velocity_by_post = {post.post_id: calculate_post_velocity(post, now) for post in members}
        ordered = sorted(members, key=lambda post: (-velocity_by_post[post.post_id], post.post_id))
        title, extractive = build_extractive_headline_title([post.text for post in ordered[:20]], story_key, category)
        related = [term for term, _count in ranked_terms[1:4]]
        headline = Headline(
            story_key=story_key,
            title=title,
            summary=build_headline_summary(len(members), len(author_ids), HEADLINE_WINDOW_HOURS, related),
            category=category,
            post_ids=[post.post_id for post in ordered[:MAXIMUM_POSTS_PER_HEADLINE]],
            post_count=len(members),
            author_count=len(author_ids),
            top_hashtags=[term for term, _count in ranked_terms[:4]],
            generated_by="extractive_v1" if extractive else "template_v1",
            updated_at=now,
        )
        story_score = sum(velocity_by_post.values()) * math.log1p(len(author_ids))
        scored.append((story_score, headline))
    scored.sort(key=lambda pair: (-pair[0], pair[1].story_key))
    return HeadlineResponse(
        headlines=[headline for _score, headline in scored[: request.limit]],
        metadata=RankingResponseMetadata(
            request_id=resolve_request_identifier(None),
            ranking_source="headlines:hashtag_clusters",
            generated_at=now,
        ),
    )
