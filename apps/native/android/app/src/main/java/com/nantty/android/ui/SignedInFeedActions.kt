package com.nantty.android.ui

import android.content.Context
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedRepository
import com.nantty.android.data.FeedFeedbackKind
import com.nantty.android.data.FeedFeedbackResult
import com.nantty.android.data.PostNotificationMuteResult
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.FollowActionResult
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.SharedContentRepository
import com.nantty.android.data.SharedContentReference
import com.nantty.android.data.SharedContentResult
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.share.sharePostFromAndroid
import java.util.concurrent.Executor
import java.util.concurrent.ConcurrentHashMap
import androidx.compose.runtime.snapshots.Snapshot

/** Owns feed mutations so navigation/state coordination stays readable in SignedInApp. */
internal class SignedInFeedActions(
    private val executor: Executor,
    private val postRepository: () -> PostDetailRepository,
    private val profileRepository: () -> PublicProfileRepository,
    private val onMessage: (String?) -> Unit,
    private val onSaving: (String?) -> Unit,
    private val isSaving: (String) -> Boolean,
    private val applyInteraction: (FeedPost, Boolean?, Boolean?, Boolean?) -> Unit,
    private val applyAuthorFollow: (String, Boolean) -> Unit,
    private val refresh: () -> Unit,
    private val shareAction: (Context, FeedPost) -> Unit = { context, post -> sharePostFromAndroid(context, post.id, post.authorName) },
    private val feedRepository: FeedRepository? = null,
    private val accessToken: () -> String? = { null },
    private val removePost: (String) -> FeedPostRemoval? = { null },
    private val restorePost: (FeedPost, FeedPostRemoval) -> Unit = { _, _ -> },
    private val applyPostNotificationsMuted: (String, Boolean) -> Unit = { _, _ -> },
    private val sharedContentRepository: SharedContentRepository = SharedContentRepository(),
) {
    private val feedbackInFlight = ConcurrentHashMap.newKeySet<String>()
    private val notificationMuteInFlight = ConcurrentHashMap.newKeySet<String>()

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

    fun resolveFeedLinkPreview(url: String, expectedAccountId: String, onResult: (com.nantty.android.data.FeedLinkPreview?) -> Unit) {
        executor.execute {
            val result = runCatching { postRepository().resolveFeedLinkPreview(url, expectedAccountId).getOrNull() }.getOrNull()
            Snapshot.withMutableSnapshot { onResult(result) }
        }
    }

    fun recordFeedLinkClick(post: FeedPost, expectedAccountId: String) {
        executor.execute {
            runCatching { postRepository().recordPostLinkClick(post.id, expectedAccountId, surface = "feed") }
        }
    }

    fun resolveSharedContent(reference: SharedContentReference, onResult: (SharedContentResult) -> Unit) {
        executor.execute {
            val result = runCatching { sharedContentRepository.resolve(reference, accessToken()) }
                .getOrElse { SharedContentResult.Failure("Could not load this Nantty link. Try again.") }
            Snapshot.withMutableSnapshot { onResult(result) }
        }
    }

    fun sendFeedFeedback(post: FeedPost, kind: FeedFeedbackKind) {
        val repository = feedRepository ?: return
        if (post.id in feedbackInFlight) return
        feedbackInFlight += post.id
        onMessage(null)
        val removedAt = removePost(post.id)
        executor.execute {
            val result = repository.recordFeedback(post.id, kind, accessToken())
            Snapshot.withMutableSnapshot {
                feedbackInFlight -= post.id
                when (result) {
                    FeedFeedbackResult.Success -> onMessage(null)
                    FeedFeedbackResult.AuthenticationRequired -> {
                        if (removedAt != null) restorePost(post, removedAt)
                        onMessage("Your session expired. Sign in again to update your feed.")
                    }
                    is FeedFeedbackResult.Failure -> {
                        if (removedAt != null) restorePost(post, removedAt)
                        onMessage(result.message)
                    }
                }
            }
        }
    }

    fun togglePostNotifications(post: FeedPost) {
        val repository = feedRepository ?: return
        if (!notificationMuteInFlight.add(post.id)) return
        val nextMuted = !post.viewerNotificationsMuted
        onMessage(null)
        applyPostNotificationsMuted(post.id, nextMuted)
        executor.execute {
            val result = repository.setPostNotificationsMuted(post.id, nextMuted, accessToken())
            Snapshot.withMutableSnapshot {
                notificationMuteInFlight -= post.id
                when (result) {
                    is PostNotificationMuteResult.Success -> {
                        applyPostNotificationsMuted(post.id, result.muted)
                        onMessage(null)
                    }
                    PostNotificationMuteResult.AuthenticationRequired -> {
                        applyPostNotificationsMuted(post.id, post.viewerNotificationsMuted)
                        onMessage("Your session expired. Sign in again to update post notifications.")
                    }
                    is PostNotificationMuteResult.Failure -> {
                        applyPostNotificationsMuted(post.id, post.viewerNotificationsMuted)
                        onMessage(result.message)
                    }
                }
            }
        }
    }

    fun followAuthor(post: FeedPost) {
        val authorId = post.authorId.takeIf(String::isNotBlank) ?: return
        onMessage(null)
        applyAuthorFollow(authorId, true)
        executor.execute {
            val result = runCatching { profileRepository().setFollow(authorId, follow = true) }
                .getOrElse { FollowActionResult.Failure(it.message ?: "Could not follow this account. Try again.") }
            Snapshot.withMutableSnapshot {
                when (result) {
                    is FollowActionResult.Success -> {
                        if (result.state == "accepted" || result.state == "requested") {
                            applyAuthorFollow(authorId, true)
                            onMessage(null)
                        } else {
                            applyAuthorFollow(authorId, false)
                            onMessage("Nantty returned an unexpected follow status. Try again.")
                        }
                    }
                    is FollowActionResult.Failure -> {
                        applyAuthorFollow(authorId, false)
                        onMessage(result.message)
                    }
                }
            }
        }
    }

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

internal fun createSignedInFeedActions(
    executor: Executor,
    postRepository: () -> PostDetailRepository,
    profileRepository: () -> PublicProfileRepository,
    onMessage: (String?) -> Unit,
    onSaving: (String?) -> Unit,
    isSaving: (String) -> Boolean,
    applyInteraction: (FeedPost, Boolean?, Boolean?, Boolean?) -> Unit,
    applyAuthorFollow: (String, Boolean) -> Unit,
    refresh: () -> Unit,
    feedRepository: FeedRepository? = null,
    accessToken: () -> String? = { null },
    removePost: (String) -> FeedPostRemoval? = { null },
    restorePost: (FeedPost, FeedPostRemoval) -> Unit = { _, _ -> },
    applyPostNotificationsMuted: (String, Boolean) -> Unit = { _, _ -> },
) = SignedInFeedActions(
    executor = executor,
    postRepository = postRepository,
    profileRepository = profileRepository,
    onMessage = onMessage,
    onSaving = onSaving,
    isSaving = isSaving,
    applyInteraction = applyInteraction,
    applyAuthorFollow = applyAuthorFollow,
    refresh = refresh,
    feedRepository = feedRepository,
    accessToken = accessToken,
    removePost = removePost,
    restorePost = restorePost,
    applyPostNotificationsMuted = applyPostNotificationsMuted,
)

internal fun createSignedInFeedActionsForScreen(
    executor: Executor,
    postRepository: () -> PostDetailRepository,
    profileRepository: PublicProfileRepository,
    sessionRepository: AccountSessionRepository,
    feedRepository: FeedRepository,
    controller: SignedInFeedController,
    onMessage: (String?) -> Unit,
    onSaving: (String?) -> Unit,
    isSaving: (String) -> Boolean,
    refresh: () -> Unit,
    applyPostNotificationsMuted: (String, Boolean) -> Unit = controller::applyPostNotificationsMuted,
): SignedInFeedActions = createSignedInFeedActions(
    executor = executor,
    postRepository = postRepository,
    profileRepository = { profileRepository },
    onMessage = onMessage,
    onSaving = onSaving,
    isSaving = isSaving,
    applyInteraction = controller::applyInteraction,
    applyAuthorFollow = controller::applyAuthorFollow,
    refresh = refresh,
    feedRepository = feedRepository,
    accessToken = { sessionRepository.sessionOrNull()?.accessToken },
    removePost = controller::removePost,
    restorePost = controller::restorePost,
    applyPostNotificationsMuted = applyPostNotificationsMuted,
)

internal fun signedInFeedFeedbackAction(
    isGuest: Boolean,
    requireSignIn: () -> Unit,
    actions: SignedInFeedActions,
): FeedFeedbackAction = { post, kind ->
    if (isGuest) requireSignIn() else actions.sendFeedFeedback(post, kind)
}

internal fun signedInPostNotificationMuteAction(
    isGuest: Boolean,
    requireSignIn: () -> Unit,
    actions: SignedInFeedActions,
): (FeedPost) -> Unit = { post ->
    if (isGuest) requireSignIn() else actions.togglePostNotifications(post)
}

internal fun signedInFeedPostActions(
    report: ((FeedPost) -> Unit)?,
    isGuest: Boolean,
    requireSignIn: () -> Unit,
    actions: SignedInFeedActions,
    onQuote: (com.nantty.android.data.FeedQuotedPost) -> Unit,
) = FeedDestinationPostActions(
    report = report,
    feedback = signedInFeedFeedbackAction(isGuest, requireSignIn, actions),
    quote = { post -> if (isGuest) requireSignIn() else onQuote(post) },
    togglePostNotifications = signedInPostNotificationMuteAction(isGuest, requireSignIn, actions),
    resolveLinkPreview = if (isGuest) null else actions::resolveFeedLinkPreview,
    recordLinkClick = if (isGuest) null else actions::recordFeedLinkClick,
)
