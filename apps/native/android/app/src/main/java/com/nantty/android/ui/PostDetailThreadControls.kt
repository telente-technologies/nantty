package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.R
import com.nantty.android.data.PostThreadFilter
import com.nantty.android.data.ThreadSort

@Composable
internal fun PostDetailThreadControls(
    filter: PostThreadFilter,
    quoteCount: Int,
    onFilterChange: (PostThreadFilter) -> Unit,
    sort: ThreadSort,
    sortMenuExpanded: Boolean,
    onSortMenuExpandedChange: (Boolean) -> Unit,
    onSortChange: (ThreadSort) -> Unit,
    enabled: Boolean,
) {
    Row(
        Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            stringResource(if (filter == PostThreadFilter.QUOTES) R.string.post_thread_quotes else R.string.post_thread_replies),
            Modifier.weight(1f),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
        FilterChip(
            selected = filter == PostThreadFilter.REPLIES,
            onClick = { onFilterChange(PostThreadFilter.REPLIES) },
            enabled = enabled,
            label = { Text(stringResource(R.string.post_thread_replies)) },
            modifier = Modifier.testTag("post-thread-replies-filter").semantics { selected = filter == PostThreadFilter.REPLIES },
        )
        if (quoteCount > 0) {
            FilterChip(
                selected = filter == PostThreadFilter.QUOTES,
                onClick = { onFilterChange(PostThreadFilter.QUOTES) },
                enabled = enabled,
                label = { Text(stringResource(R.string.post_thread_quotes_count, quoteCount)) },
                modifier = Modifier.testTag("post-thread-quotes-filter").semantics { selected = filter == PostThreadFilter.QUOTES },
            )
        }
        if (filter == PostThreadFilter.REPLIES) {
            androidx.compose.foundation.layout.Box {
                TextButton(
                    onClick = { onSortMenuExpandedChange(true) },
                    enabled = enabled,
                    modifier = Modifier.semantics { contentDescription = "Sort replies, currently ${sort.label}" },
                ) { Text(sort.label) }
                DropdownMenu(expanded = sortMenuExpanded, onDismissRequest = { onSortMenuExpandedChange(false) }) {
                    ThreadSort.entries.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option.label) },
                            leadingIcon = { RadioButton(selected = option == sort, onClick = null) },
                            onClick = { onSortMenuExpandedChange(false); onSortChange(option) },
                            modifier = Modifier.semantics {
                                contentDescription = "Sort replies by ${option.label}"
                                selected = option == sort
                            },
                        )
                    }
                }
            }
        }
    }
}
