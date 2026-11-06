package com.nantty.android.data

enum class PostThreadFilter(val apiValue: String) {
    REPLIES("all"),
    QUOTES("quotes"),
}

data class PostThreadQuote(
    val id: String,
    val quotedPost: FeedQuotedPost,
)

sealed interface PostThreadRow {
    val id: String

    data class Comment(val value: ThreadComment) : PostThreadRow {
        override val id: String get() = value.id
    }

    data class Quote(val value: PostThreadQuote) : PostThreadRow {
        override val id: String get() = "quote-${value.id}"
    }
}

internal fun appendUniquePostThreadRows(existing: List<PostThreadRow>, incoming: List<PostThreadRow>): List<PostThreadRow> {
    val seen = existing.mapTo(mutableSetOf(), PostThreadRow::id)
    return existing + incoming.filter { seen.add(it.id) }
}

internal fun updatePostThreadCommentLike(rows: List<PostThreadRow>, commentId: String, liked: Boolean): List<PostThreadRow> =
    rows.map { row ->
        if (row is PostThreadRow.Comment && commentContainsThreadComment(row.value, commentId)) {
            PostThreadRow.Comment(updateThreadCommentLike(listOf(row.value), commentId, liked).single())
        } else row
    }

private fun commentContainsThreadComment(comment: ThreadComment, targetId: String): Boolean =
    comment.id == targetId || comment.replies.any { commentContainsThreadComment(it, targetId) }
