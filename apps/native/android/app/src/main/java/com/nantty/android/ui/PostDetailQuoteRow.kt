package com.nantty.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.nantty.android.R
import com.nantty.android.data.PostThreadQuote

@Composable
internal fun PostDetailQuoteRow(quote: PostThreadQuote, onOpen: (String) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(
            stringResource(R.string.post_thread_quoted_this_post),
            Modifier.padding(bottom = 6.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium,
        )
        FeedQuotedPostCard(
            quotedPost = quote.quotedPost,
            unavailable = false,
            onOpen = { onOpen(quote.id) },
        )
    }
}
