package com.nantty.android.ui

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.runtime.Composable
import com.nantty.android.data.FeedMedia
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedQuotedPost

@Composable
internal fun FeedRepostActionsDialog(
    post: FeedPost,
    onDismiss: () -> Unit,
    onRepost: (FeedPost) -> Unit,
    onQuote: (FeedQuotedPost) -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Share this post") },
        text = { Text("Repost it for your followers or add your own words as a quote.") },
        confirmButton = {
            TextButton(
                onClick = { onDismiss(); onRepost(post) },
                modifier = Modifier.testTag("feed-repost-confirm"),
            ) { Text(if (post.reposted) "Undo repost" else "Repost") }
        },
        dismissButton = {
            TextButton(
                onClick = { onDismiss(); onQuote(post.toFeedQuotedPost()) },
                modifier = Modifier.testTag("feed-quote-action"),
            ) { Text("Quote") }
        },
    )
}

internal fun FeedPost.toFeedQuotedPost(): FeedQuotedPost = FeedQuotedPost(
    id = id,
    kind = kind,
    authorName = authorName,
    username = username,
    avatarUrl = avatarUrl,
    verified = verified,
    verificationColor = verificationColor,
    text = text,
    thumbnailUrl = media.firstNotNullOfOrNull(FeedMedia::previewUrl),
)

private fun FeedMedia.previewUrl(): String? = when (type) {
    "video" -> posterUrl?.takeIf(String::isNotBlank) ?: url.takeIf(String::isNotBlank)
    else -> url.takeIf(String::isNotBlank)
}
