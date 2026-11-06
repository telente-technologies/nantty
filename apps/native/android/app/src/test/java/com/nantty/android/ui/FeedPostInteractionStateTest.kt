package com.nantty.android.ui

import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FeedPostInteractionStateTest {
    @Test
    fun updatesTargetPostAndAdjustsCountsOnlyWhenStateChanges() {
        val post = post(likes = 2, liked = false, reposts = 3, reposted = true)
        val other = post(id = "other")
        val result = FeedResult.Success(listOf(post, other), "next")

        val updated = result.withPostInteraction(post, liked = true, reposted = false, bookmarked = true) as FeedResult.Success

        assertEquals(3, updated.posts.first().likes)
        assertTrue(updated.posts.first().liked)
        assertEquals(2, updated.posts.first().reposts)
        assertFalse(updated.posts.first().reposted)
        assertTrue(updated.posts.first().bookmarked)
        assertEquals(other, updated.posts[1])
        assertEquals("next", updated.nextCursor)
    }

    @Test
    fun preservesNonSuccessAndUnchangedCounts() {
        val failed = FeedResult.Failure("offline")
        assertEquals(failed, failed.withPostInteraction(post(), liked = false))

        val post = post(likes = 2, liked = true)
        val result = FeedResult.Success(listOf(post), null).withPostInteraction(post, liked = true) as FeedResult.Success
        assertEquals(2, result.posts.single().likes)
    }

    private fun post(id: String = "post", likes: Int = 0, liked: Boolean = false, reposts: Int = 0, reposted: Boolean = false) =
        FeedPost(id, "Ari", "ari", null, false, null, null, null, null, "post", "", emptyList(), likes, 0, reposts, 0, "2026-11-05", liked, reposted)
}
