package com.nantty.android.ui.stories

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.nantty.android.data.StoriesRepository
import com.nantty.android.data.StoryAnalytics
import com.nantty.android.data.StoryAnalyticsResult
import com.nantty.android.data.StoryItem
import com.nantty.android.data.StoryViewersPage
import com.nantty.android.data.StoryViewersResult
import java.util.concurrent.Executor
import java.util.concurrent.atomic.AtomicInteger

@Composable
internal fun StoryAnalyticsDialog(
    repository: StoriesRepository,
    story: StoryItem,
    executor: Executor,
    onDismiss: () -> Unit,
    onReauthenticate: () -> Unit,
) {
    var analytics by remember(repository, story.id) { mutableStateOf<StoryAnalyticsResult?>(null) }
    var viewers by remember(repository, story.id) { mutableStateOf<StoryViewersPage?>(null) }
    var viewerError by remember(repository, story.id) { mutableStateOf<String?>(null) }
    var cursor by remember(repository, story.id) { mutableStateOf<String?>(null) }
    var loadingMore by remember(repository, story.id) { mutableStateOf(false) }
    var reload by remember(repository, story.id) { mutableIntStateOf(0) }
    val generation = remember(repository, story.id) { AtomicInteger() }
    DisposableEffect(generation) { onDispose { generation.incrementAndGet() } }

    LaunchedEffect(repository, story.id, reload) {
        val request = generation.incrementAndGet()
        analytics = null
        viewers = null
        viewerError = null
        cursor = null
        executor.execute {
            val loadedAnalytics = repository.loadAnalytics(story.id)
            val loadedViewers = repository.loadViewers(story.id)
            if (generation.get() != request) return@execute
            Snapshot.withMutableSnapshot {
                analytics = loadedAnalytics
                when (loadedViewers) {
                    is StoryViewersResult.Success -> { viewers = loadedViewers.page; cursor = loadedViewers.page.nextCursor }
                    is StoryViewersResult.Failure -> {
                        viewerError = loadedViewers.message
                        if (loadedViewers.authenticationRequired) onReauthenticate()
                    }
                }
                if ((loadedAnalytics as? StoryAnalyticsResult.Failure)?.authenticationRequired == true) onReauthenticate()
            }
        }
    }

    fun loadMore() {
        val next = cursor ?: return
        if (loadingMore) return
        loadingMore = true
        val request = generation.get()
        executor.execute {
            val loaded = repository.loadViewers(story.id, next)
            if (generation.get() != request) return@execute
            Snapshot.withMutableSnapshot {
                loadingMore = false
                when (loaded) {
                    is StoryViewersResult.Success -> {
                        val current = viewers
                        viewers = if (current == null) loaded.page else current.copy(
                            viewers = (current.viewers + loaded.page.viewers).distinctBy { it.id },
                            total = loaded.page.total,
                            nextCursor = loaded.page.nextCursor,
                        )
                        cursor = loaded.page.nextCursor
                        viewerError = null
                    }
                    is StoryViewersResult.Failure -> {
                        viewerError = loaded.message
                        if (loaded.authenticationRequired) onReauthenticate()
                    }
                }
            }
        }
    }

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            modifier = Modifier.fillMaxWidth().widthIn(max = 520.dp).heightIn(max = 720.dp).padding(16.dp).testTag("story-analytics"),
            shape = MaterialTheme.shapes.large,
            color = MaterialTheme.colorScheme.surface,
        ) {
            LazyColumn(Modifier.padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Story analytics", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                        TextButton(onClick = onDismiss) { Text("Close") }
                    }
                    Text("Only you can see these numbers.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                when (val result = analytics) {
                    null -> item { CircularProgressIndicator(Modifier.padding(12.dp)) }
                    is StoryAnalyticsResult.Failure -> item {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(result.message, color = MaterialTheme.colorScheme.error)
                            if (result.authenticationRequired) TextButton(onClick = onReauthenticate) { Text("Sign in again") }
                            else TextButton(onClick = { reload++ }) { Text("Try again") }
                        }
                    }
                    is StoryAnalyticsResult.Success -> item { StoryAnalyticsMetrics(result.analytics) }
                }
                item {
                    HorizontalDivider()
                    val page = viewers
                    Text("Viewed by ${page?.total ?: "…"}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp))
                }
                val rows = viewers?.viewers.orEmpty()
                if (rows.isEmpty()) {
                    item {
                        Text(
                            viewerError ?: if (viewers == null) "Loading viewers…" else "No views yet. Share your story to get it seen.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (viewerError == null) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.error,
                        )
                        if (viewerError != null) TextButton(onClick = { reload++ }) { Text("Try again") }
                    }
                } else {
                    items(rows, key = { it.id }) { viewer ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            AsyncImage(model = viewer.avatarUrl, contentDescription = null, modifier = Modifier.padding(top = 4.dp).widthIn(min = 36.dp, max = 36.dp).heightIn(min = 36.dp, max = 36.dp))
                            Column(Modifier.weight(1f)) {
                                Text(viewer.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                                if (viewer.username.isNotBlank()) Text("@${viewer.username}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                    if (cursor != null || loadingMore) item {
                        TextButton(onClick = ::loadMore, enabled = !loadingMore, modifier = Modifier.fillMaxWidth().testTag("story-viewers-load-more")) {
                            Text(if (loadingMore) "Loading…" else "Load more viewers")
                        }
                    }
                    if (viewerError != null) item {
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text(viewerError!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                            TextButton(onClick = ::loadMore) { Text("Retry loading viewers") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StoryAnalyticsMetrics(data: StoryAnalytics) {
    val metrics = listOf(
        "Views" to data.impressions,
        "Unique viewers" to data.uniqueViewers,
        "Replies" to data.comments,
        "Shares" to data.shares,
        "Profile visits" to data.profileVisits,
        "New follows" to data.newFollows,
    )
    Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.testTag("story-analytics-metrics")) {
        metrics.chunked(2).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { (label, value) ->
                    Column(Modifier.weight(1f).padding(vertical = 6.dp)) {
                        Text(java.text.NumberFormat.getIntegerInstance().format(value), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                if (row.size == 1) Column(Modifier.weight(1f)) { }
            }
        }
    }
}
