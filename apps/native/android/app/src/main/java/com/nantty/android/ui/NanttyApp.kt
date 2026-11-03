package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import coil.compose.AsyncImage
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.PersonOutline
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedRepository
import com.nantty.android.data.FeedResult
import com.nantty.android.data.FeedType
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.WalletRepository
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.NotificationsRepository
import com.nantty.android.data.SearchRepository
import com.nantty.android.data.SavedPostsRepository
import com.nantty.android.data.MartRepository
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.CurrentProfileRepository
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.appendUniqueFeedPosts
import com.nantty.android.share.sharePostFromAndroid
import com.nantty.android.widget.OrdersWidgetRefreshScheduler
import com.nantty.android.widget.QuickActionDestination
import com.nantty.android.widget.quickActionDestination
import androidx.window.core.layout.WindowWidthSizeClass
import androidx.window.core.layout.WindowHeightSizeClass
import java.util.concurrent.Executors
import java.util.concurrent.Executor

private enum class Destination(val title: String) {
    Feed("Home"), Mart("Mart"), Discover("Discover"), Notifications("Activity"), Messages("Messages"), Wallet("Wallet"), Orders("Orders"), Profile("Profile"), Saved("Saved posts")
}

@Composable
fun NanttyApp(
    sessionRepository: AccountSessionRepository,
    sessionExecutor: Executor,
    repository: FeedRepository = remember { FeedRepository() },
    requestedWidgetDestination: String? = null,
    onWidgetDestinationHandled: () -> Unit = {},
) {
    val appContext = LocalContext.current.applicationContext
    var session by remember { mutableStateOf<AccountSession?>(null) }
    var sessionLoading by remember { mutableStateOf(true) }
    var sessionWorking by remember { mutableStateOf(false) }
    var sessionError by remember { mutableStateOf<String?>(null) }
    fun restoreSession() {
        sessionLoading = true
        sessionWorking = true
        sessionError = null
        sessionExecutor.execute {
            try {
                val restored = sessionRepository.restore()
                if (restored != null) {
                    OrdersWidgetRefreshScheduler.refreshSoon(appContext, replaceExisting = true)
                } else {
                    OrdersWidgetRefreshScheduler.markSignedOut(appContext)
                }
                androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    session = restored
                    sessionLoading = false
                    sessionWorking = false
                }
            } catch (error: Exception) {
                if (error is com.nantty.android.data.AuthApiException && error.statusCode in setOf(401, 403)) {
                    OrdersWidgetRefreshScheduler.markSignedOut(appContext)
                }
                androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    sessionError = error.message ?: "Could not restore your session. Check your connection and try again."
                    sessionLoading = false
                    sessionWorking = false
                }
            }
        }
    }

    LaunchedEffect(sessionRepository) { restoreSession() }

    if (sessionLoading) {
        Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
    } else if (session == null) {
        SignInScreen(
            loading = sessionWorking,
            error = sessionError,
            onRetryRestore = if (sessionError != null) ::restoreSession else null,
            onSignIn = { identifier, password ->
                sessionWorking = true
                sessionError = null
                sessionExecutor.execute {
                    try {
                        val signedIn = sessionRepository.signIn(identifier, password)
                        OrdersWidgetRefreshScheduler.refreshSoon(appContext, replaceExisting = true)
                        androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                            session = signedIn
                            sessionWorking = false
                        }
                    } catch (error: Exception) {
                        androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                            sessionError = error.message ?: "Could not sign in. Check your details and try again."
                            sessionWorking = false
                        }
                    }
                }
            },
        )
    } else {
        SignedInApp(
            accountUser = session!!.user,
            sessionRepository = sessionRepository,
            onSignOut = {
                sessionWorking = true
                sessionError = null
                sessionExecutor.execute {
                    try {
                        sessionRepository.signOut()
                        OrdersWidgetRefreshScheduler.markSignedOut(appContext)
                        androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                            session = null
                            sessionLoading = false
                            sessionWorking = false
                        }
                    } catch (_: Exception) {
                        OrdersWidgetRefreshScheduler.markSignedOut(appContext)
                        androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                            session = null
                            sessionLoading = false
                            sessionWorking = false
                            sessionError = "Signed out on this device. Nantty could not confirm server sign-out."
                        }
                    }
                }
            },
            repository = repository,
            requestedWidgetDestination = requestedWidgetDestination,
            onWidgetDestinationHandled = onWidgetDestinationHandled,
        )
    }
}

@Composable
private fun SignedInApp(
    accountUser: com.nantty.android.data.AccountUser,
    sessionRepository: AccountSessionRepository,
    onSignOut: () -> Unit,
    repository: FeedRepository,
    requestedWidgetDestination: String?,
    onWidgetDestinationHandled: () -> Unit,
) {
    val shareContext = LocalContext.current.applicationContext
    var destination by rememberSaveable { mutableStateOf(Destination.Feed) }
    var selectedFeed by rememberSaveable { mutableStateOf(FeedType.FOR_YOU) }
    var feedSelectionGeneration by rememberSaveable { mutableStateOf(0) }
    var selectedPostId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedProfileId by rememberSaveable { mutableStateOf<String?>(null) }
    var showingComposer by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(requestedWidgetDestination) {
        when (quickActionDestination(requestedWidgetDestination)) {
            QuickActionDestination.Feed -> {
                destination = Destination.Feed
                showingComposer = false
            }
            QuickActionDestination.NewPost -> {
                destination = Destination.Feed
                showingComposer = true
            }
            QuickActionDestination.Wallet -> {
                destination = Destination.Wallet
                showingComposer = false
            }
            QuickActionDestination.Messages -> {
                destination = Destination.Messages
                showingComposer = false
            }
            null -> return@LaunchedEffect
        }
        onWidgetDestinationHandled()
    }
    var result by remember { mutableStateOf<FeedResult?>(null) }
    var loading by remember { mutableStateOf(false) }
    var loadingMore by remember { mutableStateOf(false) }
    var loadMoreError by remember { mutableStateOf<String?>(null) }
    var interactionMessage by remember { mutableStateOf<String?>(null) }
    var savingPostId by remember { mutableStateOf<String?>(null) }
    val executor = remember { Executors.newSingleThreadExecutor() }
    val walletRepository = remember(sessionRepository) { WalletRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val buyerOrdersRepository = remember(sessionRepository) { BuyerOrdersRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val notificationsRepository = remember(sessionRepository) { NotificationsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val messagesRepository = remember(sessionRepository) { MessagesRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val searchRepository = remember(sessionRepository) { SearchRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val savedPostsRepository = remember(sessionRepository) { SavedPostsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val martRepository = remember { MartRepository() }
    val publicProfileRepository = remember(sessionRepository) {
        PublicProfileRepository(sessionProvider = sessionRepository::sessionOrNull)
    }
    val currentProfileRepository = remember(sessionRepository) {
        CurrentProfileRepository(sessionProvider = sessionRepository::sessionOrNull)
    }

    fun refresh() {
        val requestedFeed = selectedFeed
        val requestGeneration = feedSelectionGeneration
        val accessToken = sessionRepository.sessionOrNull()?.accessToken
        loading = true
        loadMoreError = null
        executor.execute {
            val fetched = repository.load(requestedFeed, accessToken)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (selectedFeed == requestedFeed && feedSelectionGeneration == requestGeneration) {
                    result = fetched
                    loading = false
                }
            }
        }
    }

    fun selectFeed(feed: FeedType) {
        if (feed == selectedFeed) return
        if (feed == FeedType.FOLLOWING && sessionRepository.sessionOrNull()?.accessToken.isNullOrBlank()) {
            interactionMessage = "Sign in to view posts from accounts you follow."
            return
        }
        selectedFeed = feed
        feedSelectionGeneration += 1
        result = null
        loading = true
        loadingMore = false
        loadMoreError = null
        interactionMessage = null
        refresh()
    }

    fun loadMore() {
        val page = result as? FeedResult.Success ?: return
        val cursor = page.nextCursor ?: return
        if (loadingMore) return
        val requestedFeed = selectedFeed
        val requestGeneration = feedSelectionGeneration
        val accessToken = sessionRepository.sessionOrNull()?.accessToken
        loadingMore = true
        loadMoreError = null
        executor.execute {
            val next = repository.load(requestedFeed, accessToken, cursor)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (selectedFeed == requestedFeed && feedSelectionGeneration == requestGeneration) {
                    when (next) {
                        is FeedResult.Failure -> loadMoreError = next.message
                        FeedResult.AuthenticationRequired -> result = next
                        is FeedResult.Success -> {
                            val currentPage = result as? FeedResult.Success ?: page
                            result = currentPage.copy(posts = appendUniqueFeedPosts(currentPage.posts, next.posts), nextCursor = next.nextCursor)
                        }
                    }
                    loadingMore = false
                }
            }
        }
    }

    fun applyFeedInteraction(post: FeedPost, liked: Boolean? = null, reposted: Boolean? = null, bookmarked: Boolean? = null) {
        val current = result as? FeedResult.Success ?: return
        result = current.copy(posts = current.posts.map { item ->
            if (item.id != post.id) item else item.copy(
                liked = liked ?: item.liked,
                likes = if (liked == null || liked == item.liked) item.likes else (item.likes + if (liked) 1 else -1).coerceAtLeast(0),
                reposted = reposted ?: item.reposted,
                reposts = if (reposted == null || reposted == item.reposted) item.reposts else (item.reposts + if (reposted) 1 else -1).coerceAtLeast(0),
                bookmarked = bookmarked ?: item.bookmarked,
            )
        })
    }

    fun toggleFeedLike(post: FeedPost) {
        interactionMessage = null
        executor.execute {
            val nextLiked = !post.liked
            val outcome = PostDetailRepository(sessionProvider = sessionRepository::sessionOrNull).setLiked(post.id, nextLiked)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (outcome.isSuccess) applyFeedInteraction(post, liked = nextLiked)
                else interactionMessage = outcome.exceptionOrNull()?.message ?: "Could not update your like. Try again."
            }
            if (outcome.isSuccess) refresh()
        }
    }

    fun toggleFeedRepost(post: FeedPost) {
        interactionMessage = null
        executor.execute {
            val nextReposted = !post.reposted
            val outcome = PostDetailRepository(sessionProvider = sessionRepository::sessionOrNull).setReposted(post.id, nextReposted)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (outcome.isSuccess) applyFeedInteraction(post, reposted = nextReposted)
                else interactionMessage = outcome.exceptionOrNull()?.message ?: "Could not update your repost. Try again."
            }
            if (outcome.isSuccess) refresh()
        }
    }

    fun toggleFeedSaved(post: FeedPost) {
        if (savingPostId == post.id) return
        savingPostId = post.id
        interactionMessage = null
        executor.execute {
            val nextSaved = !post.bookmarked
            val outcome = PostDetailRepository(sessionProvider = sessionRepository::sessionOrNull).setSaved(post.id, nextSaved)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                savingPostId = null
                if (outcome.isSuccess) applyFeedInteraction(post, bookmarked = nextSaved)
                else interactionMessage = outcome.exceptionOrNull()?.message ?: "Could not update your saved posts. Try again."
            }
        }
    }

    fun shareFeedPost(post: FeedPost) {
        sharePostFromAndroid(shareContext, post.id, post.authorName)
    }

    LaunchedEffect(Unit) { refresh() }

    if (showingComposer) {
        HingeSafeContent {
            PostComposerScreen(
                sessionProvider = sessionRepository::sessionOrNull,
                executor = executor,
                onCancel = { showingComposer = false },
                onPublished = { postId ->
                    showingComposer = false
                    selectedPostId = postId
                    refresh()
                },
            )
        }
        return
    }

    selectedPostId?.let { postId ->
        HingeSafeContent {
            PostDetailScreen(
                postId = postId,
                sessionProvider = sessionRepository::sessionOrNull,
                executor = executor,
                onBack = {
                    selectedPostId = null
                    refresh()
                },
            )
        }
        return
    }

    selectedProfileId?.let { profileId ->
        HingeSafeContent {
            PublicProfileScreen(
                userId = profileId,
                repository = publicProfileRepository,
                executor = executor,
                onBack = { selectedProfileId = null },
                onOpenPost = { selectedPostId = it },
            )
        }
        return
    }

    HingeSafeContent {
    BoxWithConstraints(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        val wideWindow = maxWidth >= 1000.dp
        val adaptiveInfo = currentWindowAdaptiveInfoV2()
        val useNavigationRail = shouldUseNavigationRail(
            widthClass = adaptiveInfo.windowSizeClass.windowWidthSizeClass,
            heightClass = adaptiveInfo.windowSizeClass.windowHeightSizeClass,
            isTabletop = adaptiveInfo.windowPosture.isTabletop,
        )
        if (useNavigationRail) {
            Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.Center) {
                NavigationRail(Modifier.fillMaxHeight(), containerColor = MaterialTheme.colorScheme.background) {
                    Spacer(Modifier.height(18.dp))
                    BrandMark()
                    Spacer(Modifier.height(28.dp))
                    Destination.entries.filterNot { it == Destination.Saved || it == Destination.Orders || it == Destination.Mart }.forEach { item ->
                        NavigationRailItem(
                            selected = destination == item,
                            onClick = { destination = item },
                            icon = { DestinationIcon(item) },
                            label = { Text(item.title) },
                        )
                    }
                }
                Column(
                    Modifier
                        .weight(1f)
                        .widthIn(max = if (wideWindow) 680.dp else 620.dp)
                        .fillMaxHeight(),
                ) {
                    AppHeader(onRefresh = ::refresh, onOpenMart = { destination = Destination.Mart }, onOpenOrders = { destination = Destination.Orders }, accountUser = accountUser, onSignOut = onSignOut)
                    MainContent(destination, result, loading, selectedFeed = selectedFeed, canViewFollowing = !sessionRepository.sessionOrNull()?.accessToken.isNullOrBlank(), onSelectFeed = ::selectFeed, onSignInRequired = { interactionMessage = "Sign in to view posts from accounts you follow." }, onReauthenticate = onSignOut, onRefresh = ::refresh, onCreatePost = { showingComposer = true }, onOpenPost = { selectedPostId = it }, onOpenProfile = { selectedProfileId = it }, onLike = ::toggleFeedLike, onRepost = ::toggleFeedRepost, onSave = ::toggleFeedSaved, onShare = ::shareFeedPost, interactionMessage = interactionMessage, savingPostId = savingPostId, loadingMore = loadingMore, loadMoreError = loadMoreError, onLoadMore = ::loadMore, walletRepository = walletRepository, buyerOrdersRepository = buyerOrdersRepository, currentProfileRepository = currentProfileRepository, ioExecutor = executor, notificationsRepository = notificationsRepository, onNotificationReauthenticate = onSignOut, searchRepository = searchRepository, messagesRepository = messagesRepository, savedPostsRepository = savedPostsRepository, martRepository = martRepository, onOpenSavedPosts = { destination = Destination.Saved }, onBackFromSavedPosts = { destination = Destination.Feed }, onBackFromOrders = { destination = Destination.Feed }, onOpenMessages = { destination = Destination.Messages }, onOpenOrders = { destination = Destination.Orders })
                }
                if (wideWindow) {
                    Column(Modifier.width(280.dp).padding(start = 24.dp, top = 28.dp)) {
                        Text("Your Nantty", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(8.dp))
                        Text("A calmer corner of your social world.", color = MaterialTheme.colorScheme.secondary)
                    }
                }
            }
        } else {
            Column(Modifier.fillMaxSize()) {
                AppHeader(onRefresh = ::refresh, onOpenMart = { destination = Destination.Mart }, onOpenOrders = { destination = Destination.Orders }, accountUser = accountUser, onSignOut = onSignOut)
                    MainContent(destination, result, loading, selectedFeed = selectedFeed, canViewFollowing = !sessionRepository.sessionOrNull()?.accessToken.isNullOrBlank(), onSelectFeed = ::selectFeed, onSignInRequired = { interactionMessage = "Sign in to view posts from accounts you follow." }, onReauthenticate = onSignOut, onRefresh = ::refresh, onCreatePost = { showingComposer = true }, modifier = Modifier.weight(1f), onOpenPost = { selectedPostId = it }, onOpenProfile = { selectedProfileId = it }, onLike = ::toggleFeedLike, onRepost = ::toggleFeedRepost, onSave = ::toggleFeedSaved, onShare = ::shareFeedPost, interactionMessage = interactionMessage, savingPostId = savingPostId, loadingMore = loadingMore, loadMoreError = loadMoreError, onLoadMore = ::loadMore, walletRepository = walletRepository, buyerOrdersRepository = buyerOrdersRepository, currentProfileRepository = currentProfileRepository, ioExecutor = executor, notificationsRepository = notificationsRepository, onNotificationReauthenticate = onSignOut, searchRepository = searchRepository, messagesRepository = messagesRepository, savedPostsRepository = savedPostsRepository, martRepository = martRepository, onOpenSavedPosts = { destination = Destination.Saved }, onBackFromSavedPosts = { destination = Destination.Feed }, onBackFromOrders = { destination = Destination.Feed }, onOpenMessages = { destination = Destination.Messages }, onOpenOrders = { destination = Destination.Orders })
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                    Destination.entries.filterNot { it == Destination.Saved || it == Destination.Orders || it == Destination.Mart }.forEach { item ->
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

}

@Composable
private fun AppHeader(onRefresh: () -> Unit, onOpenMart: () -> Unit, onOpenOrders: () -> Unit, accountUser: com.nantty.android.data.AccountUser, onSignOut: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BrandMark()
        Spacer(Modifier.width(12.dp))
        Text("nantty", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.weight(1f))
        IconButton(onClick = onOpenMart, modifier = Modifier.semantics { contentDescription = "Open Mart" }) {
            Icon(Icons.Default.Storefront, contentDescription = null)
        }
        IconButton(onClick = onOpenOrders, modifier = Modifier.semantics { contentDescription = "Open my orders" }) {
            Icon(Icons.Default.ReceiptLong, contentDescription = null)
        }
        Text(accountUser.name, Modifier.padding(end = 8.dp), maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelLarge)
        TextButton(onClick = onSignOut) { Text("Sign out") }
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
        Destination.Mart -> Icons.Default.Storefront
        Destination.Discover -> Icons.Default.Explore
        Destination.Notifications -> Icons.Default.NotificationsNone
        Destination.Messages -> Icons.Outlined.ChatBubbleOutline
        Destination.Wallet -> Icons.Default.AccountBalanceWallet
        Destination.Orders -> Icons.Default.ReceiptLong
        Destination.Profile -> Icons.Default.PersonOutline
        Destination.Saved -> Icons.Default.BookmarkBorder
    }
    Icon(image, contentDescription = null)
}

@Composable
private fun MainContent(
    destination: Destination,
    result: FeedResult?,
    loading: Boolean,
    selectedFeed: FeedType = FeedType.FOR_YOU,
    canViewFollowing: Boolean = true,
    onSelectFeed: (FeedType) -> Unit = {},
    onSignInRequired: () -> Unit = {},
    onReauthenticate: () -> Unit = {},
    onRefresh: () -> Unit,
    onCreatePost: () -> Unit = {},
    modifier: Modifier = Modifier,
    onOpenPost: (String) -> Unit = {},
    onOpenProfile: (String) -> Unit = {},
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
    currentProfileRepository: CurrentProfileRepository? = null,
    ioExecutor: Executor? = null,
    notificationsRepository: NotificationsRepository? = null,
    onNotificationReauthenticate: () -> Unit = {},
    searchRepository: SearchRepository? = null,
    messagesRepository: MessagesRepository? = null,
    savedPostsRepository: SavedPostsRepository? = null,
    martRepository: MartRepository? = null,
    onOpenSavedPosts: () -> Unit = {},
    onBackFromSavedPosts: () -> Unit = {},
    onBackFromOrders: () -> Unit = {},
    onOpenMessages: () -> Unit = {},
    onOpenOrders: () -> Unit = {},
) {
    if (destination == Destination.Profile && currentProfileRepository != null && ioExecutor != null) {
        CurrentProfileScreen(currentProfileRepository, ioExecutor, modifier)
        return
    }
    if (destination == Destination.Saved && savedPostsRepository != null && ioExecutor != null) {
        SavedPostsScreen(savedPostsRepository, ioExecutor, onBackFromSavedPosts, onOpenPost, onReauthenticate, modifier)
        return
    }
    if (destination == Destination.Messages && messagesRepository != null && ioExecutor != null) {
        MessagesScreen(messagesRepository, ioExecutor, modifier, onReauthenticate)
        return
    }
    if (destination == Destination.Notifications && notificationsRepository != null && ioExecutor != null) {
        NotificationsScreen(notificationsRepository, ioExecutor, modifier, onNotificationReauthenticate, onOpenPost, onOpenProfile, onOpenMessages, onOpenOrders)
        return
    }
    if (destination == Destination.Wallet && walletRepository != null && ioExecutor != null) {
        WalletScreen(walletRepository, ioExecutor, modifier)
        return
    }
    if (destination == Destination.Orders && buyerOrdersRepository != null && ioExecutor != null) {
        BuyerOrdersScreen(buyerOrdersRepository, ioExecutor, onBack = onBackFromOrders, onAuthenticationRequired = onReauthenticate, modifier = modifier)
        return
    }
    if (destination == Destination.Discover && searchRepository != null && ioExecutor != null) {
        SearchScreen(searchRepository, ioExecutor, modifier, onOpenPost, onOpenProfile, onReauthenticate)
        return
    }
    if (destination == Destination.Mart && martRepository != null) {
        MartScreen(martRepository, modifier)
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
            )
        }
        interactionMessage?.let { Text(it, Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        if (destination != Destination.Feed) {
            EmptyState("${destination.title} is coming to the native app.", "Your Nantty account and content are safe. This area will appear here as native features are added.")
        } else when {
            loading && result == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            result == FeedResult.AuthenticationRequired -> EmptyState("Sign in to view Following", "Your Following feed is private to your account. Sign in again to continue.", onReauthenticate)
            result is FeedResult.Failure -> EmptyState("Your feed could not load", result.message, onRefresh)
            result is FeedResult.Success && result.posts.isEmpty() -> EmptyState("A little quiet here", "There are no posts to show right now. Pull your world back in when you’re ready.", onRefresh)
            result is FeedResult.Success -> LazyColumn(Modifier.fillMaxSize()) {
                items(result.posts, key = FeedPost::id) { FeedCard(it, onOpenPost, onLike, onRepost, onSave, onShare, canInteract = true, saveBusy = savingPostId == it.id, onOpenProfile = onOpenProfile) }
                item(key = "feed-pagination") {
                    FeedPaginationFooter(
                        hasMore = result.nextCursor != null,
                        loading = loadingMore,
                        error = loadMoreError,
                        onLoadMore = onLoadMore,
                    )
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
) {
    TabRow(selectedTabIndex = FeedType.entries.indexOf(selectedFeed).coerceAtLeast(0)) {
        FeedType.entries.forEach { feed ->
            Tab(
                selected = selectedFeed == feed,
                onClick = {
                    if (feed == FeedType.FOLLOWING && !canViewFollowing) onSignInRequired()
                    else onSelectFeed(feed)
                },
                text = { Text(feed.title) },
            )
        }
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
internal fun FeedCard(
    post: FeedPost,
    onOpenPost: (String) -> Unit = {},
    onLike: (FeedPost) -> Unit = {},
    onRepost: (FeedPost) -> Unit = {},
    onSave: (FeedPost) -> Unit = {},
    onShare: (FeedPost) -> Unit = {},
    canInteract: Boolean = false,
    saveBusy: Boolean = false,
    onOpenProfile: (String) -> Unit = {},
) {
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
                if (post.kind == "clip") Text("CLIP", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
            }
            if (post.text.isNotBlank()) Text(post.text, Modifier.padding(top = 16.dp), style = MaterialTheme.typography.bodyLarge)
            FeedMediaGallery(post.media)
            Row(Modifier.fillMaxWidth().padding(top = 18.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                if (canInteract) {
                    IconButton(onClick = { onLike(post) }, modifier = Modifier.semantics { contentDescription = if (post.liked) "Unlike post" else "Like post" }) {
                        Icon(if (post.liked) Icons.Default.Favorite else Icons.Default.FavoriteBorder, contentDescription = null, tint = if (post.liked) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary)
                    }
                    Text(post.likes.toString(), color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.labelMedium)
                } else EngagementCount(Icons.Default.FavoriteBorder, post.likes, "likes")
                EngagementCount(Icons.Outlined.ChatBubbleOutline, post.comments, "comments")
                if (canInteract) {
                    IconButton(onClick = { onRepost(post) }, modifier = Modifier.semantics { contentDescription = if (post.reposted) "Undo repost" else "Repost" }) {
                        Icon(Icons.Default.Repeat, contentDescription = null, tint = if (post.reposted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondary)
                    }
                    Text(post.reposts.toString(), color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.labelMedium)
                    IconButton(onClick = { onSave(post) }, enabled = !saveBusy, modifier = Modifier.semantics {
                        contentDescription = if (post.bookmarked) "Remove post from saved" else "Save post"
                        selected = post.bookmarked
                    }) {
                        Icon(if (post.bookmarked) Icons.Default.Bookmark else Icons.Default.BookmarkBorder, contentDescription = null, tint = if (post.bookmarked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.secondary)
                    }
                } else EngagementCount(Icons.Default.Repeat, post.reposts, "reposts")
                IconButton(onClick = { onShare(post) }, modifier = Modifier.semantics { contentDescription = "Share post" }) {
                    Icon(Icons.Default.Share, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                }
                Text(post.shares.toString(), color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.labelMedium, modifier = Modifier.semantics { contentDescription = "${post.shares} shares" })
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
