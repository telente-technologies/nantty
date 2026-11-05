package com.nantty.android.ui

import android.content.Context
import com.nantty.android.data.FeedPost
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.share.sharePostFromAndroid
import java.util.concurrent.Executor
import androidx.compose.runtime.snapshots.Snapshot

/** Owns feed mutations so navigation/state coordination stays readable in SignedInApp. */
internal class SignedInFeedActions(
    private val executor: Executor,
    private val postRepository: () -> PostDetailRepository,
    private val onMessage: (String?) -> Unit,
    private val onSaving: (String?) -> Unit,
    private val isSaving: (String) -> Boolean,
    private val applyInteraction: (FeedPost, Boolean?, Boolean?, Boolean?) -> Unit,
    private val refresh: () -> Unit,
    private val shareAction: (Context, FeedPost) -> Unit = { context, post -> sharePostFromAndroid(context, post.id, post.authorName) },
) {
    fun like(post: FeedPost) = update(
        post = post,
        next = !post.liked,
        fallback = "Could not update your like. Try again.",
        mutation = { repository, next -> repository.setLiked(post.id, next) },
        onSuccess = { next -> applyInteraction(post, next, null, null) },
    )

    fun repost(post: FeedPost) = update(
        post = post,
        next = !post.reposted,
        fallback = "Could not update your repost. Try again.",
        mutation = { repository, next -> repository.setReposted(post.id, next) },
        onSuccess = { next -> applyInteraction(post, null, next, null) },
    )

    fun save(post: FeedPost) {
        if (isSaving(post.id)) return
        onSaving(post.id)
        onMessage(null)
        executor.execute {
            val nextSaved = !post.bookmarked
            val outcome = runCatching { postRepository().setSaved(post.id, nextSaved) }
                .getOrElse { Result.failure(it) }
            Snapshot.withMutableSnapshot {
                onSaving(null)
                if (outcome.isSuccess) applyInteraction(post, null, null, nextSaved)
                else onMessage(outcome.exceptionOrNull()?.message ?: "Could not update your saved posts. Try again.")
            }
        }
    }

    fun share(context: Context, post: FeedPost) = shareAction(context, post)

    private fun update(
        post: FeedPost,
        next: Boolean,
        fallback: String,
        mutation: (PostDetailRepository, Boolean) -> Result<Unit>,
        onSuccess: (Boolean) -> Unit,
    ) {
        onMessage(null)
        executor.execute {
            val outcome = runCatching { mutation(postRepository(), next) }
                .getOrElse { Result.failure(it) }
            Snapshot.withMutableSnapshot {
                if (outcome.isSuccess) onSuccess(next)
                else onMessage(outcome.exceptionOrNull()?.message ?: fallback)
            }
            if (outcome.isSuccess) refresh()
        }
    }
}
