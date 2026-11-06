package com.nantty.android.ui.live

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.nantty.android.data.LiveComment
import kotlinx.coroutines.flow.collectLatest

private const val LIVE_COMMENT_MAX_LENGTH = 200

@Composable
internal fun LiveCommentsPanel(
    comments: List<LiveComment>,
    loading: Boolean,
    error: String?,
    draft: String,
    sending: Boolean,
    onDraftChanged: (String) -> Unit,
    onSend: () -> Unit,
    onRetry: () -> Unit,
    hasOlderComments: Boolean,
    loadingOlderComments: Boolean,
    olderCommentsError: String?,
    onLoadOlderComments: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val visible = visibleLiveComments(comments)
    val listState = rememberLazyListState()
    var positionedAtLatest by remember { mutableStateOf(false) }
    var shouldFollowLatest by remember { mutableStateOf(true) }
    LaunchedEffect(listState) {
        snapshotFlow {
            val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index
            listState.isScrollInProgress to (lastVisible != null && lastVisible >= listState.layoutInfo.totalItemsCount - 3)
        }.collectLatest { (isScrolling, isNearLatest) ->
            if (isScrolling) shouldFollowLatest = isNearLatest
        }
    }
    LaunchedEffect(visible.lastOrNull()?.id, olderCommentsError, loadingOlderComments) {
        if (visible.isNotEmpty()) {
            val latestItemIndex = visible.lastIndex + (if (olderCommentsError != null) 1 else 0) + (if (loadingOlderComments) 1 else 0)
            if (!positionedAtLatest) {
                listState.scrollToItem(latestItemIndex)
                positionedAtLatest = true
                shouldFollowLatest = true
            } else if (shouldFollowLatest) {
                listState.animateScrollToItem(latestItemIndex)
            }
        }
    }
    LaunchedEffect(listState, visible.size, hasOlderComments, loadingOlderComments, olderCommentsError, positionedAtLatest) {
        if (!positionedAtLatest) return@LaunchedEffect
        snapshotFlow { listState.firstVisibleItemIndex <= 1 }.collectLatest { atHistoryStart ->
            if (atHistoryStart && hasOlderComments && !loadingOlderComments && olderCommentsError == null) onLoadOlderComments()
        }
    }

    Column(modifier.fillMaxWidth().padding(vertical = 12.dp)) {
        Text("Comments", style = MaterialTheme.typography.titleMedium)
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxWidth().height(120.dp).testTag("live-comments-list"),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            if (olderCommentsError != null) {
                item(key = "live-comments-history-error") {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(olderCommentsError, Modifier.weight(1f).padding(end = 8.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                        TextButton(onClick = onLoadOlderComments, enabled = !loadingOlderComments) { Text("Retry") }
                    }
                }
            }
            if (loadingOlderComments) {
                item(key = "live-comments-history-loading") { CircularProgressIndicator(Modifier.padding(8.dp)) }
            }
            items(visible, key = LiveComment::id) { comment ->
                Column(Modifier.fillMaxWidth()) {
                    Text("@${comment.author.username}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(comment.text, style = MaterialTheme.typography.bodyMedium)
                }
            }
            if (loading && visible.isEmpty()) {
                item(key = "live-comments-loading") { CircularProgressIndicator(Modifier.padding(12.dp)) }
            }
        }
        if (error != null) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(error, Modifier.weight(1f).padding(end = 8.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = onRetry, enabled = !loading) { Text("Retry") }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = draft,
                onValueChange = { value -> onDraftChanged(value.take(LIVE_COMMENT_MAX_LENGTH)) },
                modifier = Modifier.weight(1f).testTag("live-comment-input"),
                label = { Text("Add a comment") },
                singleLine = true,
                enabled = !sending,
            )
            Button(onClick = onSend, enabled = draft.isNotBlank() && !sending, modifier = Modifier.testTag("live-comment-send")) {
                Text(if (sending) "Sending…" else "Send")
            }
        }
    }
}

internal fun visibleLiveComments(comments: List<LiveComment>): List<LiveComment> =
    comments.filterNot { it.kind == "gift" }
