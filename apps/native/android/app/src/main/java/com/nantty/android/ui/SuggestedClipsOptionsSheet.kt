package com.nantty.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.nantty.android.R

/** Suggested Clips row actions and explanation, styled with the app's Material theme. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun SuggestedClipsOptionsSheet(
    visible: Boolean,
    whyVisible: Boolean,
    onDismiss: () -> Unit,
    onNotInterested: () -> Unit,
    onHideForThirtyDays: () -> Unit,
    onWhy: () -> Unit,
    onDismissWhy: () -> Unit,
) {
    if (visible) {
        ModalBottomSheet(onDismissRequest = onDismiss) {
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    stringResource(R.string.feed_suggested_clips_title),
                    Modifier.padding(horizontal = 16.dp, vertical = 12.dp).semantics { heading() },
                    style = MaterialTheme.typography.titleLarge,
                )
                ListItem(
                    headlineContent = { Text(stringResource(R.string.feed_suggested_clips_not_interested)) },
                    modifier = Modifier.fillMaxWidth().clickable(onClick = onNotInterested),
                )
                ListItem(
                    headlineContent = { Text(stringResource(R.string.feed_suggested_clips_hide_30_days)) },
                    modifier = Modifier.fillMaxWidth().clickable(onClick = onHideForThirtyDays),
                )
                ListItem(
                    headlineContent = { Text(stringResource(R.string.feed_suggested_clips_why)) },
                    modifier = Modifier.fillMaxWidth().clickable(onClick = onWhy),
                )
            }
        }
    }
    if (whyVisible) {
        ModalBottomSheet(onDismissRequest = onDismissWhy) {
            Column(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 8.dp)) {
                Text(
                    stringResource(R.string.feed_suggested_clips_why_title),
                    Modifier.semantics { heading() },
                    style = MaterialTheme.typography.titleLarge,
                )
                Text(
                    stringResource(R.string.feed_suggested_clips_why_body),
                    Modifier.padding(top = 12.dp, bottom = 16.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                TextButton(onClick = onDismissWhy) {
                    Text(stringResource(android.R.string.ok))
                }
            }
        }
    }
}
