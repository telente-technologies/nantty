package com.nantty.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedLinkPreview
import com.nantty.android.data.FeedFeedbackKind
import com.nantty.android.data.FeedQuotedPost
import com.nantty.android.data.FeedResult
import com.nantty.android.data.FeedType
import com.nantty.android.data.CartRepository
import com.nantty.android.data.MartProductAd
import com.nantty.android.data.ProductAdResult
import com.nantty.android.data.ProductAdsRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.Executor
import java.util.UUID

internal typealias FeedFeedbackAction = (FeedPost, FeedFeedbackKind) -> Unit

internal data class FeedDestinationPostActions(
    val report: ((FeedPost) -> Unit)? = null,
    val feedback: FeedFeedbackAction? = null,
    val quote: ((FeedQuotedPost) -> Unit)? = null,
    val togglePostNotifications: ((FeedPost) -> Unit)? = null,
    val resolveLinkPreview: ((String, String, (FeedLinkPreview?) -> Unit) -> Unit)? = null,
    val recordLinkClick: ((FeedPost, String) -> Unit)? = null,
    val resolveSharedContent: ((com.nantty.android.data.SharedContentReference, (com.nantty.android.data.SharedContentResult) -> Unit) -> Unit)? = null,
    val openSharedContent: ((com.nantty.android.data.SharedContentCard) -> Unit)? = null,
)

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
    activeProfileId: String? = null,
    onOpenAnalytics: ((String) -> Unit)? = null,
    postActions: FeedDestinationPostActions = FeedDestinationPostActions(),
    onFollowAuthor: ((FeedPost) -> Unit)? = null,
    onOpenProduct: ((String) -> Unit)? = null,
    productAdsRepository: ProductAdsRepository? = null,
    cartRepository: CartRepository? = null,
    ioExecutor: Executor? = null,
    onSignInRequiredWithAction: ((() -> Unit) -> Unit) = {},
    onOpenCart: () -> Unit = {},
) {
    val posts = (result as? FeedResult.Success)?.posts.orEmpty()
    val firstPostId = posts.firstOrNull()?.id
    val shouldRequestProductAd = destination == Destination.Feed && selectedFeed == FeedType.FOR_YOU &&
        currentAccountId != null && posts.size >= PRODUCT_AD_MINIMUM_ORGANIC_POSTS && posts.none(FeedPost::isSponsored)
    val adSessionId = rememberSaveable(currentAccountId, selectedFeed, firstPostId) { "feed_ads_${UUID.randomUUID()}" }
    var productAd by remember(adSessionId) { mutableStateOf<MartProductAd?>(null) }
    var feedAdImpressionRecorded by rememberSaveable(adSessionId) { mutableStateOf(false) }
    val adScope = rememberCoroutineScope()
    LaunchedEffect(productAdsRepository, adSessionId, shouldRequestProductAd) {
        if (!shouldRequestProductAd || productAdsRepository == null) return@LaunchedEffect
        val neighbours = posts.drop(PRODUCT_AD_INSERT_AFTER_POSTS - 1).take(2).map(FeedPost::id)
        val decided = withContext(Dispatchers.IO) {
            productAdsRepository.decideFeedProductAd(adSessionId, PRODUCT_AD_INSERT_AFTER_POSTS, neighbours)
        }
        productAd = (decided as? ProductAdResult.Success)?.ad
    }
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
                    LazyColumn(Modifier.fillMaxSize().testTag("feed-post-list")) {
                        itemsIndexed(result.posts, key = { _, post -> post.id }) { index, post ->
                            FeedCard(
                                post,
                                onOpenPost,
                                onLike,
                                onRepost,
                                onSave,
                                onShare,
                                canInteract = canViewFollowing,
                                saveBusy = savingPostId == post.id,
                                onOpenProfile = onOpenProfile,
                                canReportPost = post.authorId != currentAccountId,
                                onReportPost = postActions.report,
                                onFeedFeedback = postActions.feedback,
                                onTogglePostNotifications = postActions.togglePostNotifications,
                                onQuotePost = postActions.quote,
                                currentAccountId = currentAccountId,
                                activeProfileId = activeProfileId,
                                onOpenAnalytics = onOpenAnalytics,
                                onFollowAuthor = onFollowAuthor,
                                onOpenProduct = onOpenProduct,
                                cartRepository = cartRepository,
                                ioExecutor = ioExecutor,
                                onRequireSignInWithAction = onSignInRequiredWithAction,
                                onOpenCart = onOpenCart,
                                onResolveFeedLinkPreview = postActions.resolveLinkPreview,
                                onRecordFeedLinkClick = postActions.recordLinkClick?.let { record ->
                                    currentAccountId?.let { accountId -> { post -> record(post, accountId) } }
                                },
                                onResolveSharedContent = postActions.resolveSharedContent,
                                onOpenSharedContent = postActions.openSharedContent,
                            )
                            if (index == PRODUCT_AD_INSERT_AFTER_POSTS - 1 && productAd != null && onOpenProduct != null && productAdsRepository != null) {
                                val ad = requireNotNull(productAd)
                                FeedProductAdCard(
                                    ad = ad,
                                    onOpenProduct = {
                                        if (ioExecutor != null) ioExecutor.execute { productAdsRepository.recordClick(ad) }
                                        else adScope.launch(Dispatchers.IO) { productAdsRepository.recordClick(ad) }
                                        onOpenProduct(ad.productId)
                                    },
                                    onViewed = { viewed ->
                                        if (feedAdImpressionRecorded) true
                                        else withContext(Dispatchers.IO) { productAdsRepository.recordImpression(viewed) }
                                            .also { recorded -> if (recorded) feedAdImpressionRecorded = true }
                                    },
                                )
                            }
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

private const val PRODUCT_AD_MINIMUM_ORGANIC_POSTS = 8
private const val PRODUCT_AD_INSERT_AFTER_POSTS = 8
