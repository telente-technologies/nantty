package com.nantty.android.ui

import androidx.compose.runtime.MutableState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshots.Snapshot
import com.nantty.android.data.FeedRepository
import com.nantty.android.data.FeedTopic
import com.nantty.android.data.FeedTopicsResult
import java.util.concurrent.Executor

internal data class SignedInFeedTopicsState(
    val topics: List<FeedTopic> = emptyList(),
    val loading: Boolean = false,
    val error: String? = null,
)

internal data class SignedInFeedTopicsFeature(
    val state: MutableState<SignedInFeedTopicsState>,
    val controller: SignedInFeedTopicsController,
)

@Composable
internal fun rememberSignedInFeedTopics(
    repository: FeedRepository,
    executor: Executor,
): SignedInFeedTopicsFeature {
    val state = remember(repository) { mutableStateOf(SignedInFeedTopicsState()) }
    val controller = remember(repository, executor, state) {
        SignedInFeedTopicsController(repository, executor, state)
    }
    return SignedInFeedTopicsFeature(state, controller)
}

@Composable
internal fun SignedInFeedTopicSelector(
    state: SignedInFeedTopicsState,
    selectedTopicId: String?,
    onSelectTopic: (String?) -> Unit,
    onReload: () -> Unit,
) {
    FeedTopicSelector(state.topics, selectedTopicId, state.loading, state.error, onSelectTopic, onReload)
}

/** Loads followed-feed topics off the UI thread and publishes one consistent UI-state update. */
internal class SignedInFeedTopicsController(
    private val repository: FeedRepository,
    private val executor: Executor,
    private val state: MutableState<SignedInFeedTopicsState>,
) {
    fun load(accessToken: String?) {
        if (state.value.loading) return
        state.value = state.value.copy(loading = true, error = null)
        executor.execute {
            val result = repository.loadFollowedTopics(accessToken)
            Snapshot.withMutableSnapshot {
                state.value = when (result) {
                    is FeedTopicsResult.Success -> state.value.copy(topics = result.topics, loading = false)
                    is FeedTopicsResult.Failure -> state.value.copy(error = result.message, loading = false)
                    FeedTopicsResult.AuthenticationRequired -> state.value.copy(
                        error = "Sign in again to load your followed topics.",
                        loading = false,
                    )
                }
            }
        }
    }
}
