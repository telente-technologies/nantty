package com.nantty.android.ui.live

import com.nantty.android.data.LiveComment
import com.nantty.android.data.LiveCommentAuthor
import org.junit.Assert.assertEquals
import org.junit.Test

class LiveCommentsPanelTest {
    @Test
    fun keepsAllLoadedHistoryAndHidesLegacyGiftRows() {
        val comments = (1..15).map { index ->
            comment(id = "comment-$index", kind = if (index == 14) "gift" else "comment")
        }

        val visible = visibleLiveComments(comments)

        assertEquals(14, visible.size)
        assertEquals("comment-1", visible.first().id)
        assertEquals("comment-15", visible.last().id)
        assertEquals(false, visible.any { it.kind == "gift" })
    }

    @Test
    fun mergesPolledNewerCommentsWithOlderCursorPagesAndDeduplicates() {
        val merged = mergeLiveCommentHistory(
            listOf(comment("comment-2", "comment"), comment("comment-3", "comment")),
            listOf(comment("comment-1", "comment"), comment("comment-2", "reply"), comment("gift", "gift")),
        )

        assertEquals(listOf("comment-1", "comment-2", "comment-3"), merged.map(LiveComment::id))
        assertEquals("reply", merged[1].kind)
    }
}

private fun comment(id: String, kind: String) = LiveComment(
    id = id,
    liveId = "live-123",
    author = LiveCommentAuthor("user-1", "Viewer", "viewer", null),
    text = "Hello",
    kind = kind,
    createdAt = "2026-11-06T00:00:00Z",
    pinned = false,
)
