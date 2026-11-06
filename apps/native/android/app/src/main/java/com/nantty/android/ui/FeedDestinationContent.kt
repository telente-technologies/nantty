package com.nantty.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedQuotedPost
import com.nantty.android.data.FeedResult
import com.nantty.android.data.FeedType

/** Feed and generic fallback presentation; destination selection stays in [MainContent]. */
@Composable
internal fun FeedDestinationContent(
    destination: Destination,
    result: FeedResult?,
    loading: Boolean,
    selectedFeed: FeedType,
    canViewFollowing: Boolean,
    onSelectFeed: (FeedType) -> Unit,
    onSignInRequired: () -> Unit,
    onFollowingSignInRequired: () -> Unit,
    onRefresh: () -> Unit,
    onCreatePost: () -> Unit,
    modifier: Modifier,
    onOpenPost: (String) -> Unit,
    onOpenProfile: (String) -> Unit,
    onLike: (FeedPost) -> Unit,
    onRepost: (FeedPost) -> Unit,
    onSave: (FeedPost) -> Unit,
    onShare: (FeedPost) -> Unit,
    interactionMessage: String?,
    onReauthenticate: () -> Unit,
    savingPostId: String?,
    loadingMore: Boolean,
    loadMoreError: String?,
    onLoadMore: () -> Unit,
    onOpenSavedPosts: () -> Unit,
    currentAccountId: String? = null,
    onReportPost: ((FeedPost) -> Unit)? = null,
    onQuotePost: ((FeedQuotedPost) -> Unit)? = null,
    onFollowAuthor: ((FeedPost) -> Unit)? = null,
) {
    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                if (destination == Destination.Feed) "Your feed" else destination.title,
                Modifier.weight(1f).semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            if (destination == Destination.Feed) {
                IconButton(onClick = onOpenSavedPosts, modifier = Modifier.semantics { contentDescription = "Open saved posts" }) {
                    Icon(Icons.Default.BookmarkBorder, contentDescription = null)
                }
                IconButton(onClick = onCreatePost, modifier = Modifier.semantics { contentDescription = "Create post" }) {
                    Icon(Icons.Default.Add, contentDescription = null)
                }
            }
        }
        if (destination == Destination.Feed) {
            FeedTabSelector(
                selectedFeed = selectedFeed,
                canViewFollowing = canViewFollowing,
                onSelectFeed = onSelectFeed,
                onSignInRequired = onSignInRequired,
                onFollowingSignInRequired = onFollowingSignInRequired,
            )
        }
        interactionMessage?.let {
            Text(
                it,
                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp),
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        if (destination != Destination.Feed) {
            EmptyState(
                "${destination.title} is coming to the native app.",
                "Your Nantty account and content are safe. This area will appear here as native features are added.",
            )
        } else {
            when {
                loading && result == null -> Column(Modifier.fillMaxSize()) {
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                result == FeedResult.AuthenticationRequired -> EmptyState(
                    "Sign in to view Following",
                    "Your Following feed is private to your account. Sign in again to continue.",
                    onReauthenticate,
                )
                result is FeedResult.Failure -> Column(Modifier.fillMaxSize()) {
                    EmptyState("Your feed could not load", result.message, onRefresh)
                }
                result is FeedResult.Success && result.posts.isEmpty() -> Column(Modifier.fillMaxSize()) {
                    EmptyState("A little quiet here", "There are no posts to show right now. Pull your world back in when you’re ready.", onRefresh)
                }
                result is FeedResult.Success -> PullToRefreshBox(
                    isRefreshing = loading,
                    onRefresh = onRefresh,
                    modifier = Modifier.weight(1f).fillMaxWidth().testTag("feed-pull-to-refresh"),
                ) {
                    LazyColumn(Modifier.fillMaxSize()) {
                        items(result.posts, key = FeedPost::id) {
                            FeedCard(
                                it,
                                onOpenPost,
                                onLike,
                                onRepost,
                                onSave,
                                onShare,
                                canInteract = canViewFollowing,
                                saveBusy = savingPostId == it.id,
                                onOpenProfile = onOpenProfile,
                                canReportPost = it.authorId != currentAccountId,
                                onReportPost = onReportPost,
                                onQuotePost = onQuotePost,
                                currentAccountId = currentAccountId,
                                onFollowAuthor = onFollowAuthor,
                            )
                        }
                        item(key = "feed-pagination") {
                            FeedPaginationFooter(
                                hasMore = result.nextCursor != null,
                                loading = loadingMore,
                                error = loadMoreError,
                                onLoadMore = onLoadMore,
                            )
                        }
                    }
                }
                else -> EmptyState("Connecting to Nantty", "Your feed will show here.")
            }
        }
    }
}
