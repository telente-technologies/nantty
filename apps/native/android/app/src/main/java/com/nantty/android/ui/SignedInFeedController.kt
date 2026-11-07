package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshots.Snapshot
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.FeedRepository
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedResult
import com.nantty.android.data.FeedType
import com.nantty.android.data.appendUniqueFeedPosts
import java.util.concurrent.Executor

@Composable
internal fun rememberSignedInFeedController(
    repository: FeedRepository,
    sessionRepository: AccountSessionRepository,
    executor: Executor,
    selection: SignedInFeedSelectionState,
    content: SignedInFeedContentState,
): SignedInFeedController = remember(repository, sessionRepository, executor) {
    SignedInFeedController(
        executor = executor,
        accessToken = { sessionRepository.sessionOrNull()?.accessToken },
        loadPage = repository::load,
        selection = selection,
        content = content,
    )
}

internal data class SignedInFeedRuntime(
    val controller: SignedInFeedController,
    val topics: SignedInFeedTopicsFeature,
    val content: SignedInFeedContentState,
)

@Composable
internal fun rememberSignedInFeedRuntime(
    repository: FeedRepository,
    sessionRepository: AccountSessionRepository,
    executor: Executor,
    selection: SignedInFeedSelectionState,
): SignedInFeedRuntime {
    val content = remember(repository, sessionRepository) {
        SignedInFeedContentState(
            result = mutableStateOf<FeedResult?>(null),
            loading = mutableStateOf(false),
            loadingMore = mutableStateOf(false),
            loadMoreError = mutableStateOf<String?>(null),
            interactionMessage = mutableStateOf<String?>(null),
        )
    }
    val controller = rememberSignedInFeedController(repository, sessionRepository, executor, selection, content)
    val topics = rememberSignedInFeedTopics(repository, executor)
    return remember(controller, topics, content) { SignedInFeedRuntime(controller, topics, content) }
}

/** Saveable feed selection is kept by the composition; this controller owns feed loading transitions. */
internal data class SignedInFeedSelectionState(
    val feed: MutableState<FeedType>,
    val topicId: MutableState<String?>,
    val generation: MutableState<Int>,
)

internal data class SignedInFeedContentState(
    val result: MutableState<FeedResult?>,
    val loading: MutableState<Boolean>,
    val loadingMore: MutableState<Boolean>,
    val loadMoreError: MutableState<String?>,
    val interactionMessage: MutableState<String?>,
)

internal data class FeedPostRemoval(val index: Int, val selectionGeneration: Int)

internal class SignedInFeedController(
    private val executor: Executor,
    private val accessToken: () -> String?,
    private val loadPage: (FeedType, String?, String?, String?) -> FeedResult,
    private val selection: SignedInFeedSelectionState,
    private val content: SignedInFeedContentState,
) {
    val result: FeedResult? get() = content.result.value
    val loading: Boolean get() = content.loading.value
    val loadingMore: Boolean get() = content.loadingMore.value
    val loadMoreError: String? get() = content.loadMoreError.value
    val interactionMessage: String? get() = content.interactionMessage.value

    fun showInteractionMessage(message: String?) {
        content.interactionMessage.value = message
    }

    fun refresh() {
        val requestedFeed = selection.feed.value
        val requestedTopicId = selection.topicId.value.takeIf { requestedFeed == FeedType.FOR_YOU }
        val requestGeneration = selection.generation.value
        val token = accessToken()
        content.loading.value = true
        content.loadMoreError.value = null
        executor.execute {
            val fetched = loadPage(requestedFeed, token, null, requestedTopicId)
            Snapshot.withMutableSnapshot {
                if (selection.feed.value == requestedFeed && selection.generation.value == requestGeneration) {
                    content.result.value = fetched
                    content.loading.value = false
                }
            }
        }
    }

    fun selectFeed(feed: FeedType) {
        if (feed == selection.feed.value && selection.topicId.value == null) return
        if (feed == FeedType.FOLLOWING && accessToken().isNullOrBlank()) {
            content.interactionMessage.value = "Sign in to view posts from accounts you follow."
            return
        }
        selection.feed.value = feed
        selection.topicId.value = null
        selection.generation.value += 1
        content.result.value = null
        content.loading.value = true
        content.loadingMore.value = false
        content.loadMoreError.value = null
        content.interactionMessage.value = null
        refresh()
    }

    fun selectTopic(topicId: String?) {
        if (selection.feed.value == FeedType.FOR_YOU && selection.topicId.value == topicId) return
        selection.feed.value = FeedType.FOR_YOU
        selection.topicId.value = topicId
        selection.generation.value += 1
        content.result.value = null
        content.loading.value = true
        content.loadingMore.value = false
        content.loadMoreError.value = null
        content.interactionMessage.value = null
        refresh()
    }

    fun loadMore() {
        val page = content.result.value as? FeedResult.Success ?: return
        val cursor = page.nextCursor ?: return
        if (content.loadingMore.value) return
        val requestedFeed = selection.feed.value
        val requestedTopicId = selection.topicId.value.takeIf { requestedFeed == FeedType.FOR_YOU }
        val requestGeneration = selection.generation.value
        val token = accessToken()
        content.loadingMore.value = true
        content.loadMoreError.value = null
        executor.execute {
            val next = loadPage(requestedFeed, token, cursor, requestedTopicId)
            Snapshot.withMutableSnapshot {
                if (selection.feed.value == requestedFeed && selection.generation.value == requestGeneration) {
                    when (next) {
                        is FeedResult.Failure -> content.loadMoreError.value = next.message
                        FeedResult.AuthenticationRequired -> content.result.value = next
                        is FeedResult.Success -> {
                            val currentPage = content.result.value as? FeedResult.Success ?: page
                            content.result.value = currentPage.copy(
                                posts = appendUniqueFeedPosts(currentPage.posts, next.posts),
                                nextCursor = next.nextCursor,
                            )
                        }
                    }
                    content.loadingMore.value = false
                }
            }
        }
    }

    fun applyInteraction(
        post: FeedPost,
        liked: Boolean? = null,
        reposted: Boolean? = null,
        bookmarked: Boolean? = null,
    ) {
        content.result.value = content.result.value.withPostInteraction(post, liked, reposted, bookmarked)
    }

    fun applyAuthorFollow(authorId: String, following: Boolean) {
        content.result.value = content.result.value.withAuthorFollowState(authorId, following)
    }

    fun applyPostNotificationsMuted(postId: String, muted: Boolean) {
        content.result.value = content.result.value.withPostNotificationsMuted(postId, muted)
    }

    fun removePost(postId: String): FeedPostRemoval? {
        val current = content.result.value as? FeedResult.Success ?: return null
        val index = current.posts.indexOfFirst { it.id == postId }
        if (index < 0) return null
        content.result.value = current.copy(posts = current.posts.filterNot { it.id == postId })
        return FeedPostRemoval(index, selection.generation.value)
    }

    fun restorePost(post: FeedPost, removal: FeedPostRemoval) {
        if (selection.generation.value != removal.selectionGeneration) return
        val current = content.result.value as? FeedResult.Success ?: return
        if (current.posts.any { it.id == post.id }) return
        val restored = current.posts.toMutableList().apply { add(removal.index.coerceIn(0, size), post) }
        content.result.value = current.copy(posts = restored)
    }
}
