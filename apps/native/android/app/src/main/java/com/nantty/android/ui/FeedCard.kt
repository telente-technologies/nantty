package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nantty.android.R
import coil.compose.AsyncImage
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedQuotedPost
import com.nantty.android.data.FeedFeedbackKind
import com.nantty.android.data.CartRepository
import com.nantty.android.data.SharedContentReference
import com.nantty.android.data.SharedContentResult
import com.nantty.android.data.SharedContentCard
import java.util.concurrent.Executor

@Composable
internal fun FeedCard(
    post: FeedPost,
    onOpenPost: (String) -> Unit = {},
    onLike: ((FeedPost) -> Unit)? = null,
    onRepost: ((FeedPost) -> Unit)? = null,
    onSave: ((FeedPost) -> Unit)? = null,
    onShare: ((FeedPost) -> Unit)? = null,
    canInteract: Boolean = false,
    saveBusy: Boolean = false,
    onOpenProfile: (String) -> Unit = {},
    onOpenComments: (String) -> Unit = onOpenPost,
    canReportPost: Boolean = true,
    onReportPost: ((FeedPost) -> Unit)? = null,
    onFeedFeedback: ((FeedPost, FeedFeedbackKind) -> Unit)? = null,
    onTogglePostNotifications: ((FeedPost) -> Unit)? = null,
    onQuotePost: ((FeedQuotedPost) -> Unit)? = null,
    currentAccountId: String? = null,
    activeProfileId: String? = null,
    onOpenAnalytics: ((String) -> Unit)? = null,
    onFollowAuthor: ((FeedPost) -> Unit)? = null,
    onOpenProduct: ((String) -> Unit)? = null,
    cartRepository: CartRepository? = null,
    ioExecutor: Executor? = null,
    onRequireSignInWithAction: ((() -> Unit) -> Unit) = {},
    onOpenCart: () -> Unit = {},
    onResolveFeedLinkPreview: ((String, String, (com.nantty.android.data.FeedLinkPreview?) -> Unit) -> Unit)? = null,
    onRecordFeedLinkClick: ((FeedPost) -> Unit)? = null,
    onOpenExternalFeedLink: ((String) -> Boolean)? = null,
    onResolveSharedContent: ((SharedContentReference, (SharedContentResult) -> Unit) -> Unit)? = null,
    onOpenSharedContent: ((SharedContentCard) -> Unit)? = null,
) {
    var reportMenuExpanded by remember(post.id) { mutableStateOf(false) }
    var repostActionsVisible by remember(post.id) { mutableStateOf(false) }
    var taggedProductsVisible by remember(post.id) { mutableStateOf(false) }
    val requestRepostAction = {
        if (onRepost != null) {
            if (onQuotePost != null) repostActionsVisible = true else onRepost(post)
        }
    }
    val morePostOptionsLabel = stringResource(R.string.feed_post_more_options)
    val reportPostLabel = stringResource(R.string.report_post_title)
    val notInterestedLabel = stringResource(R.string.feed_not_interested)
    val hidePostLabel = stringResource(R.string.feed_hide_post)
    val postNotificationsLabel = stringResource(
        if (post.viewerNotificationsMuted) R.string.feed_turn_notifications_on else R.string.feed_turn_notifications_off,
    )
    val followAuthorLabel = stringResource(R.string.feed_follow_author)
    val followAuthorDescription = post.username.takeIf(String::isNotBlank)?.let {
        stringResource(R.string.feed_follow_author_description, it)
    } ?: followAuthorLabel
    val canOpenAnalytics = (post.authorId.isNotBlank() && post.authorId == currentAccountId) ||
        (!post.postedAsId.isNullOrBlank() && post.postedAsId == activeProfileId)
    Surface(color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp).clickable { onOpenPost(post.id) }, shape = RoundedCornerShape(18.dp), tonalElevation = 1.dp) {
        Column(Modifier.padding(18.dp)) {
            Row(
                Modifier.fillMaxWidth().sizeIn(minHeight = 48.dp)
                    .clickable(enabled = post.authorId.isNotBlank()) { onOpenProfile(post.authorId) }
                    .semantics(mergeDescendants = true) { contentDescription = "Open ${post.authorName}'s profile" },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(42.dp).background(MaterialTheme.colorScheme.primary.copy(alpha = 0.12f), CircleShape), contentAlignment = Alignment.Center) {
                    Text(post.authorName.firstOrNull()?.uppercase() ?: "N", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                    post.avatarUrl?.let {
                        AsyncImage(it, contentDescription = null, modifier = Modifier.fillMaxSize().clip(CircleShape), contentScale = ContentScale.Crop)
                    }
                }
                Column(Modifier.weight(1f).padding(start = 12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(post.authorName, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
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
                    Text(if (post.username.isBlank()) "On Nantty" else "@${post.username}", color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (!post.postedAsName.isNullOrBlank()) Text("Posted as ${post.postedAsName}${post.postedAsHandle?.takeIf(String::isNotBlank)?.let { " · @$it" }.orEmpty()}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                if (canReportPost && onReportPost != null) {
                    Box {
                        IconButton(
                            onClick = { reportMenuExpanded = true },
                            modifier = Modifier.semantics { contentDescription = morePostOptionsLabel },
                        ) { Icon(Icons.Default.MoreVert, contentDescription = null) }
                        DropdownMenu(expanded = reportMenuExpanded, onDismissRequest = { reportMenuExpanded = false }) {
                            if (onFeedFeedback != null && canReportPost) {
                                DropdownMenuItem(
                                    text = { Text(notInterestedLabel) },
                                    onClick = {
                                        reportMenuExpanded = false
                                        onFeedFeedback(post, FeedFeedbackKind.NOT_INTERESTED)
                                    },
                                    modifier = Modifier.semantics { contentDescription = notInterestedLabel },
                                )
                                DropdownMenuItem(
                                    text = { Text(hidePostLabel) },
                                    onClick = {
                                        reportMenuExpanded = false
                                        onFeedFeedback(post, FeedFeedbackKind.HIDE)
                                    },
                                    modifier = Modifier.semantics { contentDescription = hidePostLabel },
                                )
                            }
                            if (onTogglePostNotifications != null && canReportPost) {
                                DropdownMenuItem(
                                    text = { Text(postNotificationsLabel) },
                                    onClick = {
                                        reportMenuExpanded = false
                                        onTogglePostNotifications(post)
                                    },
                                    modifier = Modifier.semantics { contentDescription = postNotificationsLabel },
                                )
                            }
                            DropdownMenuItem(
                                text = { Text(reportPostLabel) },
                                onClick = {
                                    reportMenuExpanded = false
                                    onReportPost(post)
                                },
                                modifier = Modifier.semantics { contentDescription = reportPostLabel },
                            )
                        }
                    }
                }
                if (onFollowAuthor != null && !post.isFollowingAuthor && post.authorId.isNotBlank() && post.authorId != currentAccountId) {
                    TextButton(
                        onClick = { onFollowAuthor(post) },
                        modifier = Modifier.semantics { contentDescription = followAuthorDescription },
                    ) { Text(followAuthorLabel) }
                }
                if (post.kind == "clip") Text("CLIP", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
            }
            if (post.text.isNotBlank()) Text(post.text, Modifier.padding(top = 16.dp), style = MaterialTheme.typography.bodyLarge)
            if (post.quotedPost != null || post.quotedPostUnavailable) {
                FeedQuotedPostCard(
                    quotedPost = post.quotedPost,
                    unavailable = post.quotedPostUnavailable,
                    onOpen = onOpenPost,
                )
            }
            FeedPostLinkPreview(
                post = post,
                currentAccountId = currentAccountId,
                onResolve = onResolveFeedLinkPreview,
                onRecordClick = onRecordFeedLinkClick,
                onOpen = onOpenExternalFeedLink,
                onResolveSharedContent = onResolveSharedContent,
                onOpenSharedContent = onOpenSharedContent,
                onRequireSignInWithAction = onRequireSignInWithAction,
            )
            FeedMediaGallery(
                media = post.media,
                post = post,
                onLike = onLike?.let { action -> { action(post) } },
                onOpenComments = { onOpenComments(post.id) },
                onRepost = onRepost?.let { { requestRepostAction() } },
                onSave = onSave?.let { action -> { action(post) } },
                saveBusy = saveBusy,
                onShare = onShare?.let { action -> { action(post) } },
            )
            if (post.products.isNotEmpty() && onOpenProduct != null) {
                TextButton(
                    onClick = { taggedProductsVisible = true },
                    modifier = Modifier.testTag("feed-view-tagged-products-${post.id}"),
                ) {
                    Text(stringResource(R.string.feed_view_products, post.products.size))
                }
            }
            Row(Modifier.fillMaxWidth().padding(top = 18.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                if (canInteract) {
                    IconButton(onClick = { onLike?.invoke(post) }, modifier = Modifier.semantics { contentDescription = if (post.liked) "Unlike post" else "Like post" }) {
                        Icon(if (post.liked) Icons.Default.Favorite else Icons.Default.FavoriteBorder, contentDescription = null, tint = if (post.liked) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary)
                    }
                    Text(post.likes.toString(), color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.labelMedium)
                } else EngagementCount(Icons.Default.FavoriteBorder, post.likes, "likes")
                IconButton(
                    onClick = { onOpenComments(post.id) },
                    modifier = Modifier.semantics {
                        contentDescription = "Open ${post.comments} comments"
                    },
                ) {
                    Icon(Icons.Outlined.ChatBubbleOutline, contentDescription = null)
                }
                Text(post.comments.toString(), color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.labelMedium)
                if (canInteract) {
                    IconButton(onClick = requestRepostAction, modifier = Modifier.semantics { contentDescription = if (post.reposted) "Undo repost" else "Repost" }) {
                        Icon(Icons.Default.Repeat, contentDescription = null, tint = if (post.reposted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondary)
                    }
                    Text(post.reposts.toString(), color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.labelMedium)
                } else EngagementCount(Icons.Default.Repeat, post.reposts, "reposts")
                FeedPostViewsAction(
                    views = post.views,
                    canOpenAnalytics = canOpenAnalytics && onOpenAnalytics != null,
                    onOpenAnalytics = { onOpenAnalytics?.invoke(post.id) },
                )
                if (canInteract) {
                    IconButton(onClick = { onSave?.invoke(post) }, enabled = !saveBusy, modifier = Modifier.semantics {
                        contentDescription = if (post.bookmarked) "Remove post from saved" else "Save post"
                        selected = post.bookmarked
                    }) {
                        Icon(if (post.bookmarked) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, contentDescription = null, tint = if (post.bookmarked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondary)
                    }
                }
                IconButton(onClick = { onShare?.invoke(post) }, modifier = Modifier.semantics { contentDescription = "Share post" }) {
                    Icon(Icons.Default.Share, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                }
                Text(post.shares.toString(), color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.labelMedium, modifier = Modifier.semantics { contentDescription = "${post.shares} shares" })
            }
        }
    }
    if (repostActionsVisible && onRepost != null && onQuotePost != null) {
        FeedRepostActionsDialog(
            post = post,
            onDismiss = { repostActionsVisible = false },
            onRepost = onRepost,
            onQuote = onQuotePost,
        )
    }
    if (taggedProductsVisible && onOpenProduct != null) {
        FeedTaggedProductsSheet(
            products = post.products,
            onDismiss = { taggedProductsVisible = false },
            onOpenProduct = { productId ->
                taggedProductsVisible = false
                onOpenProduct(productId)
            },
            cartRepository = cartRepository,
            ioExecutor = ioExecutor,
            canInteract = canInteract,
            onRequireSignInWithAction = onRequireSignInWithAction,
            onOpenCart = onOpenCart,
        )
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

