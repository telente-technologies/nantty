package com.nantty.android.ui

import androidx.compose.runtime.mutableStateOf
import com.nantty.android.data.FeedResult
import com.nantty.android.data.FeedType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.Executor

class SignedInFeedControllerTest {
    @Test
    fun followingSelectionRequiresSessionWithoutChangingSelection() {
        var requests = 0
        val fixture = controller(accessToken = { null }, load = { _, _, _, _ ->
            requests += 1
            FeedResult.Success(emptyList(), null)
        })

        fixture.controller.selectFeed(FeedType.FOLLOWING)

        assertEquals(FeedType.FOR_YOU, fixture.selection.feed.value)
        assertEquals("Sign in to view posts from accounts you follow.", fixture.content.interactionMessage.value)
        assertEquals(0, requests)
    }

    @Test
    fun topicSelectionLoadsForYouWithSelectedTopicAndClearsPreviousError() {
        var requested: List<Any?>? = null
        val fixture = controller(load = { feed, token, cursor, topic ->
            requested = listOf(feed, token, cursor, topic)
            FeedResult.Success(emptyList(), null)
        })
        fixture.content.interactionMessage.value = "Previous error"
        fixture.content.loadMoreError.value = "Previous page error"

        fixture.controller.selectTopic("food")

        assertEquals(listOf(FeedType.FOR_YOU, "access-token", null, "food"), requested)
        assertEquals("food", fixture.selection.topicId.value)
        assertEquals(1, fixture.selection.generation.value)
        assertEquals(FeedResult.Success(emptyList(), null), fixture.content.result.value)
        assertFalse(fixture.content.loading.value)
        assertEquals(null, fixture.content.interactionMessage.value)
        assertEquals(null, fixture.content.loadMoreError.value)
    }

    @Test
    fun staleRefreshResponseDoesNotOverwriteNewSelection() {
        val queued = mutableListOf<Runnable>()
        val fixture = controller(
            executor = Executor { queued.add(it) },
            load = { _, _, _, topic -> FeedResult.Success(emptyList(), topic) },
        )

        fixture.controller.refresh()
        fixture.controller.selectTopic("new-topic")
        assertEquals(2, queued.size)

        queued.removeAt(0).run()
        assertTrue(fixture.content.loading.value)
        assertEquals(null, fixture.content.result.value)

        queued.removeAt(0).run()
        assertFalse(fixture.content.loading.value)
        assertEquals(FeedResult.Success(emptyList(), "new-topic"), fixture.content.result.value)
    }

    private fun controller(
        accessToken: () -> String? = { "access-token" },
        executor: Executor = Executor { it.run() },
        load: (FeedType, String?, String?, String?) -> FeedResult,
    ): Fixture {
        val selection = SignedInFeedSelectionState(
            feed = mutableStateOf(FeedType.FOR_YOU),
            topicId = mutableStateOf(null),
            generation = mutableStateOf(0),
        )
        val content = SignedInFeedContentState(
            result = mutableStateOf(null),
            loading = mutableStateOf(false),
            loadingMore = mutableStateOf(false),
            loadMoreError = mutableStateOf(null),
            interactionMessage = mutableStateOf(null),
        )
        return Fixture(
            controller = SignedInFeedController(executor, accessToken, load, selection, content),
            selection = selection,
            content = content,
        )
    }

    private data class Fixture(
        val controller: SignedInFeedController,
        val selection: SignedInFeedSelectionState,
        val content: SignedInFeedContentState,
    )
}
