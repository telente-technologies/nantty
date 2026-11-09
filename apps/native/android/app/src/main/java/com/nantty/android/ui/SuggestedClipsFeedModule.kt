package com.nantty.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.background
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.ClipFeedItem
import com.nantty.android.R

/** Presentational rail for suggested clips. Callers own loading, cadence, and navigation. */
@Composable
internal fun SuggestedClipsFeedModule(
    clips: List<ClipFeedItem>,
    onOpenClip: (String) -> Unit,
    onMore: (List<String>) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (clips.isEmpty()) return

    Column(
        modifier = modifier.fillMaxWidth().testTag("feed-suggested-clips"),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        val moreOptionsLabel = stringResource(R.string.feed_suggested_clips_more_options)
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(R.string.feed_suggested_clips_title),
                modifier = Modifier.weight(1f).semantics { heading() },
                style = MaterialTheme.typography.titleMedium,
            )
            IconButton(
                onClick = { onMore(clips.map { it.post.id }) },
                modifier = Modifier
                    .semantics { contentDescription = moreOptionsLabel }
                    .testTag("suggested-clips-more"),
            ) {
                Icon(Icons.Default.MoreVert, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        LazyRow(
            modifier = Modifier.fillMaxWidth().testTag("suggested-clips-row"),
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp),
        ) {
            items(clips, key = { it.post.id }) { clip ->
                SuggestedClipCard(
                    clip = clip,
                    onOpen = { onOpenClip(clip.post.id) },
                )
            }
        }
    }
}

@Composable
private fun SuggestedClipCard(
    clip: ClipFeedItem,
    onOpen: () -> Unit,
) {
    val post = clip.post
    val posterUrl = post.media.firstOrNull()?.posterUrl
    val label = stringResource(R.string.feed_suggested_clip_play_by, post.authorName)
    Box(
        modifier = Modifier
            .size(width = 160.dp, height = 230.dp)
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onOpen)
            .semantics { contentDescription = label }
            .testTag("suggested-clip-${post.id}"),
        contentAlignment = Alignment.Center,
    ) {
        if (!posterUrl.isNullOrBlank()) {
            AsyncImage(
                model = posterUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize().testTag("suggested-clip-poster-${post.id}"),
            )
        } else {
            Box(
                Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surfaceVariant)
                    .testTag("suggested-clip-poster-${post.id}"),
            )
        }
    }
}
