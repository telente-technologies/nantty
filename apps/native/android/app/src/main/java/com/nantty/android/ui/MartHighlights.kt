package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.MartHighlight

@Composable
internal fun MartHighlights(
    highlights: List<MartHighlight>,
    onOpen: (MartHighlight) -> Unit,
    onViewed: (MartHighlight) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (highlights.isEmpty()) return
    val pagerState = rememberPagerState(pageCount = { highlights.size })
    val current = highlights.getOrNull(pagerState.currentPage)
    LaunchedEffect(current?.id) { current?.let(onViewed) }

    Column(modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(end = 28.dp),
            pageSpacing = 10.dp,
        ) { page ->
            val highlight = highlights[page]
            Card(
                onClick = { onOpen(highlight) },
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
                modifier = Modifier.fillMaxWidth().height(156.dp).semantics {
                    contentDescription = listOfNotNull(highlight.title, highlight.subtitle, highlight.sponsored?.label).joinToString(". ")
                },
            ) {
                Box(Modifier.fillMaxWidth().height(156.dp).background(MaterialTheme.colorScheme.surfaceContainerHighest)) {
                    highlight.imageUrl?.let { imageUrl ->
                        AsyncImage(
                            model = imageUrl,
                            contentDescription = null,
                            modifier = Modifier.matchParentSize().clip(RoundedCornerShape(18.dp)),
                            contentScale = ContentScale.Crop,
                        )
                    }
                    Column(
                        Modifier.align(Alignment.BottomStart).fillMaxWidth()
                            .background(MaterialTheme.colorScheme.scrim.copy(alpha = 0.66f))
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(highlight.title, color = MaterialTheme.colorScheme.inverseOnSurface, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        val caption = highlight.sponsored?.let { listOfNotNull(it.label, it.advertiserName, highlight.subtitle).filter(String::isNotBlank).joinToString(" · ") }
                            ?: listOfNotNull(highlight.subtitle, highlight.reasonLabel.takeIf(String::isNotBlank)).joinToString(" · ")
                        if (caption.isNotBlank()) Text(caption, color = MaterialTheme.colorScheme.inverseOnSurface, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
        if (highlights.size > 1) {
            Text(
                text = "${pagerState.currentPage + 1} of ${highlights.size}",
                modifier = Modifier.align(Alignment.End),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}
