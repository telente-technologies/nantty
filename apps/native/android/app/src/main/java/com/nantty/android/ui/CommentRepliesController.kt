package com.nantty.android.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.ThreadComment
import com.nantty.android.data.appendUniqueThreadComments
import com.nantty.android.data.isRepeatedThreadCursor
import com.nantty.android.data.updateThreadCommentLike
import java.util.concurrent.Executor

internal data class CommentRepliesUiState(
    val comments: List<ThreadComment> = emptyList(),
    val nextCursor: String? = null,
    val expanded: Boolean = false,
    val loaded: Boolean = false,
    val loading: Boolean = false,
    val loadingMore: Boolean = false,
    val error: String? = null,
    val usedCursors: Set<String> = emptySet(),
)

internal class CommentRepliesController(
    private val repository: PostDetailRepository,
    private val executor: Executor,
) {
    var states by mutableStateOf<Map<String, CommentRepliesUiState>>(emptyMap())
        private set

    fun state(commentId: String): CommentRepliesUiState = states[commentId] ?: CommentRepliesUiState()

    fun expand(commentId: String) {
        val current = state(commentId)
        states = states + (commentId to current.copy(expanded = true))
        if (!current.loaded && !current.loading) loadPage(commentId, cursor = null, append = false)
    }

    fun loadMore(commentId: String) {
        val current = state(commentId)
        if (current.loading || current.loadingMore) return
        val cursor = current.nextCursor
        if (cursor == null && current.loaded && current.error == null) return
        loadPage(commentId, cursor, append = cursor != null)
    }

    fun updateLike(commentId: String, liked: Boolean) {
        val current = state(commentId)
        states = states + (commentId to current.copy(comments = updateThreadCommentLike(current.comments, commentId, liked)))
    }

    private fun loadPage(commentId: String, cursor: String?, append: Boolean) {
        val current = state(commentId)
        if (current.loading || current.loadingMore) return
        states = states + (commentId to current.copy(
            expanded = true,
            loading = !append,
            loadingMore = append,
            error = null,
        ))
        executor.execute {
            val outcome = repository.loadCommentReplies(commentId, cursor)
            Snapshot.withMutableSnapshot {
                val latest = state(commentId)
                if (outcome.isFailure) {
                    states = states + (commentId to latest.copy(
                        loading = false,
                        loadingMore = false,
                        error = outcome.exceptionOrNull()?.message ?: "Could not load replies. Try again.",
                    ))
                } else {
                    val page = outcome.getOrThrow()
                    val repeatedCursor = append && isRepeatedThreadCursor(cursor.orEmpty(), page.nextCursor, latest.usedCursors)
                    val comments = appendUniqueThreadComments(latest.comments, page.comments)
                    states = states + (commentId to latest.copy(
                        comments = comments,
                        nextCursor = page.nextCursor.takeUnless { repeatedCursor },
                        loaded = true,
                        loading = false,
                        loadingMore = false,
                        error = if (repeatedCursor) "The server repeated a reply page. Try again later." else null,
                        usedCursors = latest.usedCursors + listOfNotNull(cursor),
                    ))
                }
            }
        }
    }
}

internal fun commentRepliesActionLabel(state: CommentRepliesUiState, hiddenCount: Int): String = when {
    state.loading || state.loadingMore -> "Loading replies"
    state.error != null -> "Retry loading replies"
    state.nextCursor != null -> "Show more replies"
    hiddenCount > 0 -> "Show $hiddenCount ${if (hiddenCount == 1) "reply" else "replies"}"
    else -> "Show replies"
}

