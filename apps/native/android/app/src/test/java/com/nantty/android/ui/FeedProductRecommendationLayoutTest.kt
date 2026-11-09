package com.nantty.android.ui

import com.nantty.android.data.FeedPost
import com.nantty.android.data.ClipFeedItem
import org.junit.Assert.assertEquals
import org.junit.Test

class FeedProductRecommendationLayoutTest {
    @Test
    fun getVerifiedAppearsOnceAfterThreeLoadedRowsIncludingSponsoredRows() {
        val posts = (1..12).map { post(it, sponsored = it == 2) }

        assertEquals(null, getVerifiedInsertionBoundary(3, visible = true))
        assertEquals(3, getVerifiedInsertionBoundary(4, visible = true))
        assertEquals(3, getVerifiedInsertionBoundary(posts.size, visible = true))
        assertEquals(null, getVerifiedInsertionBoundary(posts.size, visible = false))
    }

    @Test
    fun insertsAfterSixteenOrganicPostsAndRepeatsEveryFortyFiveOrganicPosts() {
        val posts = (1..61).map(::post)

        assertEquals(listOf(16, 61), organicPostInsertionBoundaries(posts, PRODUCT_RECOMMENDATION_FIRST_AFTER_POSTS, PRODUCT_RECOMMENDATION_REPEAT_EVERY_POSTS))
    }

    @Test
    fun sponsoredPostsDoNotCountTowardRecommendationCadence() {
        val posts = buildList {
            addAll((1..15).map(::post))
            add(post(16, sponsored = true))
            addAll((17..62).map(::post))
        }

        assertEquals(listOf(17, 62), organicPostInsertionBoundaries(posts, PRODUCT_RECOMMENDATION_FIRST_AFTER_POSTS, PRODUCT_RECOMMENDATION_REPEAT_EVERY_POSTS))
    }

    @Test
    fun peopleSuggestionsUseTenThenThirtyFeedRowsLikeReactNative() {
        val posts = (1..41).map { post(it, sponsored = it == 11) }
        val suggestions = (1..20).map { index ->
            com.nantty.android.data.ExploreSuggestion(
                user = com.nantty.android.data.ExploreUserSummary("user-$index", "User $index", "user$index", null, false),
                reasonCode = "popular",
                reasonLabel = "Popular",
                isOfficial = false,
                checkmarkTier = "none",
                isPrivate = false,
            )
        }

        val placements = peopleYouMayKnowInsertions(posts, suggestions)

        assertEquals(listOf(10, 40), placements.map { it.first })
        assertEquals((1..10).map { "user-$it" }, placements.first().second.map { it.user.id })
        assertEquals((11..20).map { "user-$it" }, placements.last().second.map { it.user.id })
    }

    @Test
    fun peopleSuggestionsAreNotShownWhenFewerThanTwoRemain() {
        val posts = (1..10).map(::post)
        val suggestion = com.nantty.android.data.ExploreSuggestion(
            user = com.nantty.android.data.ExploreUserSummary("user-1", "User 1", "user1", null, false),
            reasonCode = "popular",
            reasonLabel = "Popular",
            isOfficial = false,
            checkmarkTier = "none",
            isPrivate = false,
        )

        assertEquals(emptyList<Pair<Int, List<com.nantty.android.data.ExploreSuggestion>>>(), peopleYouMayKnowInsertions(posts, listOf(suggestion)))
    }

    @Test
    fun suggestedClipsInsertAfterSixThenEveryEighteenOrganicPosts() {
        val posts = (1..42).map(::post)
        val clips = (1..24).map(::clip)

        val rows = suggestedClipsInsertions(posts, clips)

        assertEquals(listOf(6, 24, 42), rows.map { it.first })
        assertEquals((1..8).map { "clip-$it" }, rows.first().second.map { it.post.id })
        assertEquals((17..24).map { "clip-$it" }, rows.last().second.map { it.post.id })
    }

    @Test
    fun suggestedClipCadenceCountsSponsoredRowsLikeReactNative() {
        val posts = buildList {
            addAll((1..5).map(::post))
            add(post(6, sponsored = true))
            addAll((7..25).map(::post))
        }
        val clips = (1..16).map(::clip)

        val rows = suggestedClipsInsertions(posts, clips)
        assertEquals(listOf(6, 24), rows.map { it.first })
        assertEquals((1..8).map { "clip-$it" }, rows.first().second.map { it.post.id })
        assertEquals((9..16).map { "clip-$it" }, rows.last().second.map { it.post.id })
    }

    @Test
    fun suggestedClipsHideRowsWithFewerThanThreeItems() {
        assertEquals(
            emptyList<Pair<Int, List<ClipFeedItem>>>(),
            suggestedClipsInsertions((1..6).map(::post), (1..2).map(::clip)),
        )
    }

    private fun post(id: Int, sponsored: Boolean = false) = FeedPost(
        id = "post-$id",
        authorName = "Maker $id",
        username = "maker$id",
        avatarUrl = null,
        verified = false,
        verificationColor = null,
        postedAsName = null,
        postedAsHandle = null,
        postedAsAvatarUrl = null,
        kind = "post",
        text = "Post $id",
        media = emptyList(),
        likes = 0,
        comments = 0,
        reposts = 0,
        shares = 0,
        createdAt = "2026-11-07T10:00:00Z",
        isSponsored = sponsored,
    )

    private fun clip(id: Int) = ClipFeedItem(
        post = post(id).copy(id = "clip-$id", kind = "clip"),
        durationSeconds = 12,
        viewerHasAccess = true,
        isFollowingAuthor = false,
        sound = null,
    )
}
