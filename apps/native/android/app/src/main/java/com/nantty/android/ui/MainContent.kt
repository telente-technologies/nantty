package com.nantty.android.ui

import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.AccountNotificationSettingsRepository
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.CurrentProfileRepository
import com.nantty.android.data.DisputeRepository
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.ExploreRepository
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedResult
import com.nantty.android.data.FeedType
import com.nantty.android.data.FollowRequestsRepository
import com.nantty.android.data.MartRepository
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.NotificationsRepository
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.ProfileImageRepository
import com.nantty.android.data.SavedPostsRepository
import com.nantty.android.data.SearchRepository
import com.nantty.android.data.StoreRepository
import com.nantty.android.data.WalletRepository
import java.util.concurrent.Executor

@Composable
internal fun MainContent(
    destination: Destination,
    result: FeedResult?,
    loading: Boolean,
    selectedFeed: FeedType = FeedType.FOR_YOU,
    canViewFollowing: Boolean = true,
    onSelectFeed: (FeedType) -> Unit = {},
    onSignInRequired: () -> Unit = {},
    onSignInRequiredWithAction: ((() -> Unit) -> Unit) = { onSignInRequired() },
    onFollowingSignInRequired: () -> Unit = onSignInRequired,
    onReauthenticate: () -> Unit = {},
    onRefresh: () -> Unit,
    onCreatePost: () -> Unit = {},
    modifier: Modifier = Modifier,
    onOpenPost: (String) -> Unit = {},
    onOpenProfile: (String) -> Unit = {},
    searchScope: String = SearchRepository.GLOBAL_SCOPE,
    searchScopeLabel: String = "Everywhere",
    onSearchScopeChanged: (String, String) -> Unit = { _, _ -> },
    onOpenProduct: (String) -> Unit = {},
    onOpenStore: (String) -> Unit = {},
    onOpenCategory: (String, String) -> Unit = { _, _ -> },
    onLike: (FeedPost) -> Unit = {},
    onRepost: (FeedPost) -> Unit = {},
    onSave: (FeedPost) -> Unit = {},
    onShare: (FeedPost) -> Unit = {},
    interactionMessage: String? = null,
    savingPostId: String? = null,
    loadingMore: Boolean = false,
    loadMoreError: String? = null,
    onLoadMore: () -> Unit = {},
    walletRepository: WalletRepository? = null,
    buyerOrdersRepository: BuyerOrdersRepository? = null,
    disputeRepository: DisputeRepository? = null,
    privateMediaUploadsRepository: CreatorSampleMediaRepository? = null,
    currentProfileRepository: CurrentProfileRepository? = null,
    profileImagesRepository: ProfileImageRepository? = null,
    followRequestsRepository: FollowRequestsRepository? = null,
    ioExecutor: Executor? = null,
    notificationsRepository: NotificationsRepository? = null,
    accountNotificationSettingsRepository: AccountNotificationSettingsRepository? = null,
    onNotificationReauthenticate: () -> Unit = {},
    searchRepository: SearchRepository? = null,
    exploreRepository: ExploreRepository? = null,
    publicProfileRepository: PublicProfileRepository? = null,
    messagesRepository: MessagesRepository? = null,
    initialMessageConversation: InboxConversation? = null,
    onInitialMessageConversationHandled: () -> Unit = {},
    savedPostsRepository: SavedPostsRepository? = null,
    martRepository: MartRepository? = null,
    storeRepository: StoreRepository? = null,
    showMartCategoryPane: Boolean = false,
    initialMartProductId: String? = null,
    onInitialMartProductHandled: () -> Unit = {},
    initialMartCategoryId: String? = null,
    initialMartCategoryName: String? = null,
    onInitialMartCategoryHandled: () -> Unit = {},
    onOpenSavedPosts: () -> Unit = {},
    onBackFromSavedPosts: () -> Unit = {},
    onBackFromOrders: () -> Unit = {},
    onBackFromFollowRequests: () -> Unit = {},
    onOpenMessages: () -> Unit = {},
    onOpenOrders: () -> Unit = {},
    onOpenFollowRequests: () -> Unit = {},
    onSearchCurrentProfile: (String, String) -> Unit = { _, _ -> },
    onOpenConnections: (String, String) -> Unit = { _, _ -> },
    onOpenBusinessTools: () -> Unit = {},
    businessContent: (@Composable () -> Unit)? = null,
) {
    if (destination == Destination.Profile && currentProfileRepository != null && ioExecutor != null) {
        CurrentProfileScreen(
            repository = currentProfileRepository,
            executor = ioExecutor,
            modifier = modifier,
            onOpenBusinessTools = onOpenBusinessTools,
            onOpenConnections = onOpenConnections,
            onOpenProfile = onOpenProfile,
            onSearchProfile = onSearchCurrentProfile,
            publicProfileRepository = publicProfileRepository,
            profileImagesRepository = profileImagesRepository,
            onOpenPost = onOpenPost,
            followRequestsRepository = followRequestsRepository,
            onReauthenticate = onReauthenticate,
        )
        return
    }
    if (destination == Destination.FollowRequests && followRequestsRepository != null && ioExecutor != null) {
        FollowRequestsScreen(
            repository = followRequestsRepository,
            executor = ioExecutor,
            onBack = onBackFromFollowRequests,
            onReauthenticate = onReauthenticate,
            onOpenProfile = onOpenProfile,
            modifier = modifier,
        )
        return
    }
    if (destination == Destination.Business && businessContent != null) {
        businessContent()
        return
    }
    if (destination == Destination.Saved && savedPostsRepository != null && ioExecutor != null) {
        SavedPostsScreen(savedPostsRepository, ioExecutor, onBackFromSavedPosts, onOpenPost, onReauthenticate, modifier)
        return
    }
    if (destination == Destination.Messages && messagesRepository != null && ioExecutor != null) {
        MessagesScreen(
            messagesRepository,
            ioExecutor,
            modifier,
            onReauthenticate,
            initialConversation = initialMessageConversation,
            onInitialConversationHandled = onInitialMessageConversationHandled,
        )
        return
    }
    if (destination == Destination.Notifications && notificationsRepository != null && ioExecutor != null) {
        NotificationsScreen(
            repository = notificationsRepository,
            executor = ioExecutor,
            modifier = modifier,
            onReauthenticate = onNotificationReauthenticate,
            onOpenPost = onOpenPost,
            onOpenProfile = onOpenProfile,
            onOpenMessages = onOpenMessages,
            onOpenOrders = onOpenOrders,
            accountSettingsRepository = accountNotificationSettingsRepository,
            onOpenFollowRequests = onOpenFollowRequests,
        )
        return
    }
    if (destination == Destination.Wallet && walletRepository != null && ioExecutor != null) {
        WalletScreen(walletRepository, ioExecutor, modifier)
        return
    }
    if (destination == Destination.Orders && buyerOrdersRepository != null && ioExecutor != null) {
        BuyerOrdersScreen(
            repository = buyerOrdersRepository,
            executor = ioExecutor,
            onBack = onBackFromOrders,
            onAuthenticationRequired = onReauthenticate,
            disputeRepository = disputeRepository,
            privateMediaUploadsRepository = privateMediaUploadsRepository,
            modifier = modifier,
        )
        return
    }
    if (destination == Destination.Discover && searchRepository != null && ioExecutor != null) {
        SearchScreen(
            repository = searchRepository,
            executor = ioExecutor,
            modifier = modifier,
            onOpenPost = onOpenPost,
            onOpenProfile = onOpenProfile,
            onReauthenticate = onReauthenticate,
            onOpenProduct = onOpenProduct,
            onOpenStore = onOpenStore,
            onOpenCategory = onOpenCategory,
            exploreRepository = exploreRepository,
            profileRepository = publicProfileRepository,
            onRequireSignIn = onSignInRequired,
            onRequireSignInWithAction = onSignInRequiredWithAction,
            initialScope = searchScope,
            initialScopeLabel = searchScopeLabel,
            onScopeChanged = onSearchScopeChanged,
        )
        return
    }
    if (destination == Destination.Mart && martRepository != null) {
        MartScreen(
            martRepository,
            modifier,
            showCategoryPane = showMartCategoryPane,
            onAuthenticationRequired = {
                if (canViewFollowing) onReauthenticate() else onSignInRequired()
            },
            initialProductId = initialMartProductId,
            onInitialProductHandled = onInitialMartProductHandled,
            initialCategoryId = initialMartCategoryId,
            initialCategoryName = initialMartCategoryName,
            onInitialCategoryHandled = onInitialMartCategoryHandled,
            onOpenStore = onOpenStore,
            storeRepository = storeRepository,
        )
        return
    }
    Column(modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 8.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
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
        interactionMessage?.let { Text(it, Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        if (destination != Destination.Feed) {
            EmptyState("${destination.title} is coming to the native app.", "Your Nantty account and content are safe. This area will appear here as native features are added.")
        } else when {
            loading && result == null -> Column(Modifier.fillMaxSize()) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            }
            result == FeedResult.AuthenticationRequired -> EmptyState("Sign in to view Following", "Your Following feed is private to your account. Sign in again to continue.", onReauthenticate)
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
                    items(result.posts, key = FeedPost::id) { FeedCard(it, onOpenPost, onLike, onRepost, onSave, onShare, canInteract = canViewFollowing, saveBusy = savingPostId == it.id, onOpenProfile = onOpenProfile) }
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

@Composable
internal fun FeedTabSelector(
    selectedFeed: FeedType,
    canViewFollowing: Boolean,
    onSelectFeed: (FeedType) -> Unit,
    onSignInRequired: () -> Unit,
    onFollowingSignInRequired: () -> Unit = onSignInRequired,
) {
    TabRow(selectedTabIndex = FeedType.entries.indexOf(selectedFeed).coerceAtLeast(0)) {
        FeedType.entries.forEach { feed ->
            Tab(
                selected = selectedFeed == feed,
                onClick = {
                    if (feed == FeedType.FOLLOWING && !canViewFollowing) onFollowingSignInRequired()
                    else onSelectFeed(feed)
                },
                text = { Text(feed.title) },
            )
        }
    }
}

@Composable
internal fun FeedMartSectionTabs(
    selectedMart: Boolean,
    onSelectMart: (Boolean) -> Unit,
) {
    TabRow(
        selectedTabIndex = if (selectedMart) 1 else 0,
        modifier = Modifier.testTag("feed-mart-tabs").pointerInput(selectedMart) {
            var horizontalDrag = 0f
            detectHorizontalDragGestures(
                onDragEnd = {
                    resolveFeedMartSwipeTarget(selectedMart, horizontalDrag, 64.dp.toPx())
                        ?.let(onSelectMart)
                },
                onHorizontalDrag = { change, dragAmount ->
                    horizontalDrag += dragAmount
                    change.consume()
                },
            )
        },
    ) {
        Tab(selected = !selectedMart, onClick = { onSelectMart(false) }, text = { Text("Feed") })
        Tab(selected = selectedMart, onClick = { onSelectMart(true) }, text = { Text("Mart") })
    }
}

@Composable
internal fun FeedPaginationFooter(
    hasMore: Boolean,
    loading: Boolean,
    error: String?,
    onLoadMore: () -> Unit,
) {
    when {
        loading -> CircularProgressIndicator(Modifier.padding(20.dp).semantics { contentDescription = "Loading more posts" })
        error != null -> Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = onLoadMore) { Text("Try loading more") }
        }
        hasMore -> TextButton(onClick = onLoadMore, modifier = Modifier.fillMaxWidth().padding(12.dp)) { Text("Load more posts") }
        else -> Text("You’re all caught up", Modifier.fillMaxWidth().padding(20.dp), color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
internal fun EmptyState(title: String, message: String, action: (() -> Unit)? = null) {
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

