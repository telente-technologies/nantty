package com.nantty.android.ui

import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountUser
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FollowActionResult
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.PublicProfileTransport
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SignedInFeedActionsTest {
    @Test
    fun followAuthorUsesServerStateAndRefreshesFeedAfterSuccess() {
        val followWrites = mutableListOf<String>()
        val repository = profileRepository { path ->
            followWrites += path
            JSONObject("""{"data":{"state":"requested"}}""")
        }
        val followUpdates = mutableListOf<Pair<String, Boolean>>()
        var refreshes = 0
        val messages = mutableListOf<String?>()
        val actions = actions(repository, followUpdates, messages) { refreshes++ }

        actions.followAuthor(post())

        assertEquals(listOf("/api/v1/users/author-1/follow"), followWrites)
        assertEquals(listOf("author-1" to true, "author-1" to true), followUpdates)
        assertEquals(0, refreshes)
        assertEquals(listOf(null, null), messages)
    }

    @Test
    fun failedFollowRollsBackOptimisticFeedStateAndShowsError() {
        val repository = profileRepository { throw IllegalStateException("offline") }
        val followUpdates = mutableListOf<Pair<String, Boolean>>()
        val messages = mutableListOf<String?>()
        val actions = actions(repository, followUpdates, messages) {}

        actions.followAuthor(post())

        assertEquals(listOf("author-1" to true, "author-1" to false), followUpdates)
        assertTrue(messages.last().orEmpty().contains("offline"))
    }

    private fun profileRepository(postResponse: (String) -> JSONObject) = PublicProfileRepository(
        baseUrl = "https://api.nantty.com",
        transport = object : PublicProfileTransport {
            override fun get(path: String, accessToken: String?) = JSONObject()
            override fun post(path: String, accessToken: String): JSONObject = postResponse(path)
            override fun delete(path: String, accessToken: String) = Unit
        },
        sessionProvider = {
            AccountSession("access-token", "refresh-token", AccountUser("viewer-1", "Viewer", "viewer", null, null, emptyList()))
        },
    )

    private fun actions(
        profileRepository: PublicProfileRepository,
        followUpdates: MutableList<Pair<String, Boolean>>,
        messages: MutableList<String?>,
        refresh: () -> Unit,
    ) = SignedInFeedActions(
        executor = java.util.concurrent.Executor { it.run() },
        postRepository = { PostDetailRepository(sessionProvider = { null }) },
        profileRepository = { profileRepository },
        onMessage = { messages += it },
        onSaving = {},
        isSaving = { false },
        applyInteraction = { _, _, _, _ -> },
        applyAuthorFollow = { authorId, following -> followUpdates += authorId to following },
        refresh = refresh,
    )

    private fun post() = FeedPost(
        id = "post-1", authorName = "Ari", username = "ari", avatarUrl = null,
        verified = false, verificationColor = null, postedAsName = null, postedAsHandle = null,
        postedAsAvatarUrl = null, kind = "post", text = "", media = emptyList(),
        likes = 0, comments = 0, reposts = 0, shares = 0, createdAt = "2026-11-06T10:00:00Z",
        authorId = "author-1",
    )
}
