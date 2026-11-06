package com.nantty.android.ui

import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedResult

internal fun FeedResult?.withPostInteraction(
    post: FeedPost,
    liked: Boolean? = null,
    reposted: Boolean? = null,
    bookmarked: Boolean? = null,
): FeedResult? {
    val page = this as? FeedResult.Success ?: return this
    return page.copy(posts = page.posts.map { item ->
        if (item.id != post.id) item else item.copy(
            liked = liked ?: item.liked,
            likes = if (liked == null || liked == item.liked) item.likes else (item.likes + if (liked) 1 else -1).coerceAtLeast(0),
            reposted = reposted ?: item.reposted,
            reposts = if (reposted == null || reposted == item.reposted) item.reposts else (item.reposts + if (reposted) 1 else -1).coerceAtLeast(0),
            bookmarked = bookmarked ?: item.bookmarked,
        )
    })
}

internal fun FeedResult?.withAuthorFollowState(authorId: String, following: Boolean): FeedResult? {
    val page = this as? FeedResult.Success ?: return this
    return page.copy(posts = page.posts.map { post ->
        if (post.authorId == authorId) post.copy(isFollowingAuthor = following) else post
    })
}
