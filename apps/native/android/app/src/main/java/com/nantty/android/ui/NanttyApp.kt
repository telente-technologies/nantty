package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.mergeDescendants
import androidx.compose.ui.semantics.semantics
import coil.compose.AsyncImage
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ChatBubbleOutline
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.PersonOutline
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedRepository
import com.nantty.android.data.FeedResult
import java.util.concurrent.Executors

private enum class Destination(val title: String) {
    Feed("Home"), Discover("Discover"), Notifications("Activity"), Messages("Messages"), Profile("Profile")
}

@Composable
fun NanttyApp(repository: FeedRepository = remember { FeedRepository() }) {
    var destination by remember { mutableStateOf(Destination.Feed) }
    var result by remember { mutableStateOf<FeedResult?>(null) }
    var loading by remember { mutableStateOf(false) }
    val executor = remember { Executors.newSingleThreadExecutor() }

    fun refresh() {
        loading = true
        executor.execute {
            val fetched = repository.loadForYou()
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                result = fetched
                loading = false
            }
        }
    }
    LaunchedEffect(Unit) { refresh() }

    BoxWithConstraints(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        val wide = maxWidth >= 700.dp
        if (wide) {
            Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.Center) {
                NavigationRail(Modifier.fillMaxHeight(), containerColor = MaterialTheme.colorScheme.background) {
                    Spacer(Modifier.height(18.dp))
                    BrandMark()
                    Spacer(Modifier.height(28.dp))
                    Destination.entries.forEach { item ->
                        NavigationRailItem(
                            selected = destination == item,
                            onClick = { destination = item },
                            icon = { DestinationIcon(item) },
                            label = { Text(item.title) },
                        )
                    }
                }
                Column(Modifier.width(if (maxWidth >= 1000.dp) 680.dp else 620.dp).fillMaxHeight()) {
                    AppHeader(onRefresh = ::refresh)
                    MainContent(destination, result, loading, onRefresh = ::refresh)
                }
                if (maxWidth >= 1000.dp) {
                    Column(Modifier.width(280.dp).padding(start = 24.dp, top = 28.dp)) {
                        Text("Your Nantty", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(8.dp))
                        Text("A calmer corner of your social world.", color = MaterialTheme.colorScheme.secondary)
                    }
                }
            }
        } else {
            Column(Modifier.fillMaxSize()) {
                AppHeader(onRefresh = ::refresh)
                MainContent(destination, result, loading, onRefresh = ::refresh, modifier = Modifier.weight(1f))
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                    Destination.entries.forEach { item ->
                        NavigationBarItem(
                            selected = destination == item,
                            onClick = { destination = item },
                            icon = { DestinationIcon(item) },
                            label = { Text(item.title, maxLines = 1) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AppHeader(onRefresh: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BrandMark()
        Spacer(Modifier.width(12.dp))
        Text("nantty", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.weight(1f))
        TextButton(onClick = onRefresh) {
            Icon(Icons.Default.Refresh, contentDescription = "Refresh feed")
            Spacer(Modifier.width(6.dp))
            Text("Refresh")
        }
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
}

@Composable
private fun BrandMark() {
    Box(Modifier.size(38.dp).background(MaterialTheme.colorScheme.primary, CircleShape), contentAlignment = Alignment.Center) {
        Text("n", color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.Black, style = MaterialTheme.typography.titleLarge)
    }
}

@Composable
private fun DestinationIcon(destination: Destination) {
    val image = when (destination) {
        Destination.Feed -> Icons.Default.Home
        Destination.Discover -> Icons.Default.Explore
        Destination.Notifications -> Icons.Default.NotificationsNone
        Destination.Messages -> Icons.AutoMirrored.Filled.ChatBubbleOutline
        Destination.Profile -> Icons.Default.PersonOutline
    }
    Icon(image, contentDescription = null)
}

@Composable
private fun MainContent(
    destination: Destination,
    result: FeedResult?,
    loading: Boolean,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier.fillMaxSize()) {
        Text(
            if (destination == Destination.Feed) "Your feed" else destination.title,
            Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 18.dp).semantics { heading() },
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )
        if (destination != Destination.Feed) {
            EmptyState("${destination.title} is coming to the native app.", "Your Nantty account and content are safe. This area will appear here as native features are added.")
        } else when {
            loading && result == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            result is FeedResult.Failure -> EmptyState("Your feed could not load", result.message, onRefresh)
            result is FeedResult.Success && result.posts.isEmpty() -> EmptyState("A little quiet here", "There are no posts to show right now. Pull your world back in when you’re ready.", onRefresh)
            result is FeedResult.Success -> LazyColumn(Modifier.fillMaxSize()) {
                items(result.posts, key = FeedPost::id) { FeedCard(it) }
            }
            else -> EmptyState("Connecting to Nantty", "Your feed will show here.")
        }
    }
}

@Composable
private fun EmptyState(title: String, message: String, action: (() -> Unit)? = null) {
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

@Composable
internal fun FeedCard(post: FeedPost) {
    Surface(color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp), shape = RoundedCornerShape(18.dp), tonalElevation = 1.dp) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(42.dp).background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f), CircleShape), contentAlignment = Alignment.Center) {
                    val displayName = post.postedAsName ?: post.authorName
                    Text(displayName.firstOrNull()?.uppercase() ?: "N", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                    (post.postedAsAvatarUrl ?: post.avatarUrl)?.let {
                        AsyncImage(it, contentDescription = "$displayName profile photo", modifier = Modifier.fillMaxSize().clip(CircleShape), contentScale = ContentScale.Crop)
                    }
                }
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(post.postedAsName ?: post.authorName, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        val badgeColor = post.verificationColor ?: if (post.verified) "blue" else null
                        badgeColor?.let { color ->
                            Icon(
                                Icons.Default.Verified,
                                contentDescription = when (color) {
                                    "gold" -> "Verified business"
                                    "black" -> "Official government account"
                                    else -> "Verified account"
                                },
                                tint = when (color) {
                                    "gold" -> Color(0xFFB7791F)
                                    "black" -> MaterialTheme.colorScheme.onSurface
                                    else -> MaterialTheme.colorScheme.primary
                                },
                                modifier = Modifier.padding(start = 4.dp).size(16.dp),
                            )
                        }
                    }
                    val handle = post.postedAsHandle ?: post.username
                    Text(if (handle.isBlank()) "On Nantty" else "@$handle", color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                if (post.kind == "clip") Text("CLIP", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
            }
            if (post.text.isNotBlank()) Text(post.text, Modifier.padding(top = 16.dp), style = MaterialTheme.typography.bodyLarge)
            post.media.forEach { media ->
                val displayUrl = if (media.type == "video") media.posterUrl ?: media.url else media.url
                Box(Modifier.fillMaxWidth().padding(top = 14.dp), contentAlignment = Alignment.BottomStart) {
                    AsyncImage(
                        model = displayUrl,
                        contentDescription = if (media.type == "video") "Video preview" else "Post image",
                        modifier = Modifier.fillMaxWidth().aspectRatio(media.width?.toFloat()?.div(media.height?.toFloat() ?: 0f)?.takeIf { it.isFinite() && it in 0.5f..2.2f } ?: (16f / 10f)).clip(RoundedCornerShape(14.dp)),
                        contentScale = ContentScale.Crop,
                    )
                    if (media.type == "video") Text("VIDEO", Modifier.padding(10.dp).background(MaterialTheme.colorScheme.scrim.copy(alpha = 0.72f), RoundedCornerShape(6.dp)).padding(horizontal = 8.dp, vertical = 4.dp), color = MaterialTheme.colorScheme.inverseOnSurface, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                }
            }
            Row(Modifier.fillMaxWidth().padding(top = 18.dp), horizontalArrangement = Arrangement.spacedBy(22.dp), verticalAlignment = Alignment.CenterVertically) {
                EngagementCount(Icons.Default.FavoriteBorder, post.likes, "likes")
                EngagementCount(Icons.AutoMirrored.Filled.ChatBubbleOutline, post.comments, "comments")
                EngagementCount(Icons.Default.Repeat, post.reposts, "reposts")
                EngagementCount(Icons.Default.Share, post.shares, "shares")
            }
        }
    }
}

@Composable
private fun EngagementCount(icon: androidx.compose.ui.graphics.vector.ImageVector, count: Int, label: String) {
    Row(
        Modifier.semantics(mergeDescendants = true) { contentDescription = "$count $label" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(18.dp))
        Text(count.toString(), color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.labelMedium)
    }
}
