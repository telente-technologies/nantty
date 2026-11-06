package com.nantty.android.ui

import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.FeedType

@Composable
internal fun FeedTabSelector(
    selectedFeed: FeedType,
    canViewFollowing: Boolean,
    onSelectFeed: (FeedType) -> Unit,
    onSignInRequired: () -> Unit,
    onFollowingSignInRequired: () -> Unit = onSignInRequired,
) {
    TabRow(selectedTabIndex = FeedType.entries.indexOf(selectedFeed).coerceAtLeast(0)) {
        FeedType.entries.forEach { feed ->
            Tab(
                selected = selectedFeed == feed,
                onClick = {
                    if (feed == FeedType.FOLLOWING && !canViewFollowing) onFollowingSignInRequired()
                    else onSelectFeed(feed)
                },
                text = { Text(feed.title) },
            )
        }
    }
}

@Composable
internal fun FeedMartSectionTabs(selectedMart: Boolean, onSelectMart: (Boolean) -> Unit) {
    TabRow(
        selectedTabIndex = if (selectedMart) 1 else 0,
        modifier = Modifier.testTag("feed-mart-tabs").pointerInput(selectedMart) {
            var horizontalDrag = 0f
            detectHorizontalDragGestures(
                onDragEnd = { resolveFeedMartSwipeTarget(selectedMart, horizontalDrag, 64.dp.toPx())?.let(onSelectMart) },
                onHorizontalDrag = { change, dragAmount ->
                    horizontalDrag += dragAmount
                    change.consume()
                },
            )
        },
    ) {
        Tab(selected = !selectedMart, onClick = { onSelectMart(false) }, text = { Text("Feed") })
        Tab(selected = selectedMart, onClick = { onSelectMart(true) }, text = { Text("Mart") })
    }
}

@Composable
internal fun FeedPaginationFooter(hasMore: Boolean, loading: Boolean, error: String?, onLoadMore: () -> Unit) {
    when {
        loading -> CircularProgressIndicator(Modifier.padding(20.dp).semantics { contentDescription = "Loading more posts" })
        error != null -> Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = onLoadMore) { Text("Try loading more") }
        }
        hasMore -> TextButton(onClick = onLoadMore, modifier = Modifier.fillMaxWidth().padding(12.dp)) { Text("Load more posts") }
        else -> Text("You’re all caught up", Modifier.fillMaxWidth().padding(20.dp), color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
internal fun EmptyState(title: String, message: String, action: (() -> Unit)? = null) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 36.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(10.dp))
        Text(message, color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.bodyLarge)
        action?.let { TextButton(onClick = it) { Text("Try again") } }
    }
}
