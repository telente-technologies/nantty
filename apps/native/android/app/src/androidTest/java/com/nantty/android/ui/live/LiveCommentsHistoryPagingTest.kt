package com.nantty.android.ui.live

import androidx.compose.foundation.layout.height
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.unit.dp
import com.nantty.android.data.LiveComment
import com.nantty.android.data.LiveCommentAuthor
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class LiveCommentsHistoryPagingTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun scrollingToTheOldestLoadedCommentRequestsAnOlderCursorPage() {
        val loadOlderCount = mutableIntStateOf(0)
        val comments = (1..30).map { index ->
            LiveComment(
                id = "comment-$index",
                liveId = "live-123",
                author = LiveCommentAuthor("user-$index", "Viewer $index", "viewer$index", null),
                text = "Comment $index",
                kind = "comment",
                createdAt = "2026-11-06T00:${index.toString().padStart(2, '0')}:00Z",
                pinned = false,
            )
        }
        compose.setContent {
            LiveCommentsPanel(
                comments = comments,
                loading = false,
                error = null,
                draft = "",
                sending = false,
                onDraftChanged = {},
                onSend = {},
                onRetry = {},
                hasOlderComments = true,
                loadingOlderComments = false,
                olderCommentsError = null,
                onLoadOlderComments = { loadOlderCount.intValue += 1 },
                modifier = Modifier.height(200.dp),
            )
        }

        compose.onNodeWithTag("live-comments-list").performScrollToIndex(0)
        compose.runOnIdle { assertTrue("scrolling to the history boundary should request another cursor page", loadOlderCount.intValue > 0) }
    }
}
