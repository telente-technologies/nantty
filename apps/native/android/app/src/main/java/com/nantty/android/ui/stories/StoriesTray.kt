package com.nantty.android.ui.stories

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.StoryTrayEntry

@Composable
internal fun StoriesTray(
    entries: List<StoryTrayEntry>,
    onStorySelected: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        entries.forEach { entry ->
            Column(
                modifier = Modifier
                    .semantics { contentDescription = if (entry.hasUnseen) "View ${entry.name}'s unseen story" else "View ${entry.name}'s story" }
                    .clickable(role = Role.Button) { onStorySelected(entry.userId) },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Surface(
                    modifier = Modifier.size(64.dp),
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    border = BorderStroke(
                        width = if (entry.hasUnseen) 2.dp else 1.dp,
                        color = if (entry.hasUnseen) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
                    ),
                ) {
                    entry.avatarUrl?.let { url ->
                        AsyncImage(
                            model = url,
                            contentDescription = null,
                            modifier = Modifier.size(58.dp).clip(CircleShape),
                            contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                        )
                    } ?: androidx.compose.foundation.layout.Box(contentAlignment = Alignment.Center) {
                        Text(entry.name.take(1).uppercase(), color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                Text(entry.name, style = MaterialTheme.typography.labelSmall, maxLines = 1)
            }
        }
    }
}
