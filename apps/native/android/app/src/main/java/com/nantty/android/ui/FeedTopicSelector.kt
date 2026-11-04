package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.nantty.android.data.FeedTopic

@Composable
internal fun FeedTopicSelector(
    topics: List<FeedTopic>,
    selectedTopicId: String?,
    loading: Boolean,
    error: String?,
    onSelectTopic: (String?) -> Unit,
    onRetry: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().testTag("feed-topic-selector")) {
        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            item(key = "all-topics") {
                FilterChip(
                    selected = selectedTopicId == null,
                    onClick = { onSelectTopic(null) },
                    label = { Text("For You") },
                    modifier = Modifier.semantics { contentDescription = "Show all For You posts" },
                )
            }
            items(topics, key = FeedTopic::id) { topic ->
                FilterChip(
                    selected = selectedTopicId == topic.id,
                    onClick = { onSelectTopic(topic.id) },
                    label = { Text(topic.name, maxLines = 1) },
                    modifier = Modifier.semantics { contentDescription = "Show ${topic.name} posts" },
                )
            }
            if (loading) {
                item(key = "topics-loading") {
                    CircularProgressIndicator(
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 16.dp).semantics {
                            contentDescription = "Loading followed topics"
                        },
                        strokeWidth = 2.dp,
                    )
                }
            }
        }
        if (error != null) {
            Text(error, Modifier.padding(horizontal = 16.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = onRetry, enabled = !loading, modifier = Modifier.padding(start = 12.dp)) {
                Text("Retry topics", color = MaterialTheme.colorScheme.error)
            }
        }
    }
}
