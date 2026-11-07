package com.nantty.android.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.nantty.android.R

@Composable
internal fun FeedPostViewsAction(
    views: Int,
    canOpenAnalytics: Boolean,
    onOpenAnalytics: () -> Unit,
) {
    var explanationVisible by remember { mutableStateOf(false) }
    val description = stringResource(R.string.feed_post_views_accessibility, views)
    IconButton(
        onClick = { if (canOpenAnalytics) onOpenAnalytics() else explanationVisible = true },
        modifier = Modifier.semantics { contentDescription = description },
    ) {
        Icon(Icons.Default.Visibility, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
    }
    Text(views.toString(), color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.labelMedium)
    if (explanationVisible) {
        AlertDialog(
            onDismissRequest = { explanationVisible = false },
            title = { Text(stringResource(R.string.feed_post_views_info_title)) },
            text = { Text(stringResource(R.string.feed_post_views_info_body)) },
            confirmButton = {
                TextButton(onClick = { explanationVisible = false }) {
                    Text(stringResource(R.string.action_close))
                }
            },
        )
    }
}
