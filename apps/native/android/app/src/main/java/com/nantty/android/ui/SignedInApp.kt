package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.adaptive.separatingVerticalHingeBounds
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass
import com.nantty.android.data.AccountNotificationSettingsRepository
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.CartRepository
import com.nantty.android.data.CheckoutReceipt
import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.CurrentProfileRepository
import com.nantty.android.data.ExploreRepository
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedRepository
import com.nantty.android.data.FeedResult
import com.nantty.android.data.FeedTopic
import com.nantty.android.data.FeedTopicsResult
import com.nantty.android.data.FeedType
import com.nantty.android.data.MartRepository
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.NotificationsRepository
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.SavedPostsRepository
import com.nantty.android.data.SearchRepository
import com.nantty.android.data.WalletRepository
import com.nantty.android.data.appendUniqueFeedPosts
import com.nantty.android.share.sharePostFromAndroid
import com.nantty.android.widget.QuickActionDestination
import com.nantty.android.widget.quickActionDestination
import java.util.concurrent.Executors

@Composable
internal fun SignedInApp(
    accountUser: com.nantty.android.data.AccountUser?,
    isGuest: Boolean,
    sessionRepository: AccountSessionRepository,
    onRequireSignIn: () -> Unit,
    onSignOut: () -> Unit,
    repository: FeedRepository,
    requestedWidgetDestination: String?,
    onWidgetDestinationHandled: () -> Unit,
) {
    val shareContext = LocalContext.current.applicationContext
    var destination by rememberSaveable { mutableStateOf(Destination.Feed) }
    var selectedFeed by rememberSaveable { mutableStateOf(FeedType.FOR_YOU) }
    var selectedTopicId by rememberSaveable { mutableStateOf<String?>(null) }
    var feedSelectionGeneration by rememberSaveable { mutableStateOf(0) }
    var selectedPostId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedProfileId by rememberSaveable { mutableStateOf<String?>(null) }
    var showingCart by rememberSaveable { mutableStateOf(false) }
    var showingCheckout by rememberSaveable { mutableStateOf(false) }
    var showingPayment by rememberSaveable { mutableStateOf(false) }
    var checkoutId by rememberSaveable { mutableStateOf<String?>(null) }
    var checkoutOrderId by rememberSaveable { mutableStateOf<String?>(null) }
    var checkoutTotalMinor by rememberSaveable { mutableStateOf(0L) }
    var checkoutCurrency by rememberSaveable { mutableStateOf("") }
    var checkoutOrderCount by rememberSaveable { mutableStateOf(0) }
    var pendingMartProductId by rememberSaveable { mutableStateOf<String?>(null) }
    var showingComposer by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(requestedWidgetDestination) {
        if (isGuest && requestedWidgetDestination != null) {
            onRequireSignIn()
            onWidgetDestinationHandled()
            return@LaunchedEffect
        }
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
    var feedTopics by remember { mutableStateOf<List<FeedTopic>>(emptyList()) }
    var topicsLoading by remember { mutableStateOf(false) }
    var topicsError by remember { mutableStateOf<String?>(null) }
    var interactionMessage by remember { mutableStateOf<String?>(null) }
    var savingPostId by remember { mutableStateOf<String?>(null) }
    val executor = remember { Executors.newSingleThreadExecutor() }
    val walletRepository = remember(sessionRepository) { WalletRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val cartRepository = remember(sessionRepository) { CartRepository(accessTokenProvider = { sessionRepository.sessionOrNull()?.accessToken }) }
    val checkoutRepository = remember(sessionRepository) { CheckoutRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val buyerOrdersRepository = remember(sessionRepository) { BuyerOrdersRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val notificationsRepository = remember(sessionRepository) { NotificationsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val accountNotificationSettingsRepository = remember(sessionRepository) { AccountNotificationSettingsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val messagesRepository = remember(sessionRepository) {
        MessagesRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val searchRepository = remember(sessionRepository) { SearchRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val exploreRepository = remember(sessionRepository) { ExploreRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val savedPostsRepository = remember(sessionRepository) { SavedPostsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val martRepository = remember(sessionRepository) {
        MartRepository(accessTokenProvider = { sessionRepository.sessionOrNull()?.accessToken })
    }
    val publicProfileRepository = remember(sessionRepository) {
        PublicProfileRepository(sessionProvider = sessionRepository::sessionOrNull)
    }
    val currentProfileRepository = remember(sessionRepository) {
        CurrentProfileRepository(sessionProvider = sessionRepository::sessionOrNull)
    }

    fun refresh() {
        val requestedFeed = selectedFeed
        val requestedTopicId = selectedTopicId.takeIf { requestedFeed == FeedType.FOR_YOU }
        val requestGeneration = feedSelectionGeneration
        val accessToken = sessionRepository.sessionOrNull()?.accessToken
        loading = true
        loadMoreError = null
        executor.execute {
            val fetched = repository.load(requestedFeed, accessToken, topicId = requestedTopicId)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (selectedFeed == requestedFeed && feedSelectionGeneration == requestGeneration) {
                    result = fetched
                    loading = false
                }
            }
        }
    }

    fun selectFeed(feed: FeedType) {
        if (feed == selectedFeed && selectedTopicId == null) return
        if (feed == FeedType.FOLLOWING && sessionRepository.sessionOrNull()?.accessToken.isNullOrBlank()) {
            interactionMessage = "Sign in to view posts from accounts you follow."
            return
        }
        selectedFeed = feed
        selectedTopicId = null
        feedSelectionGeneration += 1
        result = null
        loading = true
        loadingMore = false
        loadMoreError = null
        interactionMessage = null
        refresh()
    }

    fun selectTopic(topicId: String?) {
        if (selectedFeed == FeedType.FOR_YOU && selectedTopicId == topicId) return
        selectedFeed = FeedType.FOR_YOU
        selectedTopicId = topicId
        feedSelectionGeneration += 1
        result = null
        loading = true
        loadingMore = false
        loadMoreError = null
        interactionMessage = null
        refresh()
    }

    fun loadTopics(accessToken: String?) {
        if (topicsLoading) return
        topicsLoading = true
        topicsError = null
        executor.execute {
            val loaded = repository.loadFollowedTopics(accessToken)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                when (loaded) {
                    is FeedTopicsResult.Success -> feedTopics = loaded.topics
                    is FeedTopicsResult.Failure -> topicsError = loaded.message
                    FeedTopicsResult.AuthenticationRequired -> topicsError = "Sign in again to load your followed topics."
                }
                topicsLoading = false
            }
        }
    }

    fun loadMore() {
        val page = result as? FeedResult.Success ?: return
        val cursor = page.nextCursor ?: return
        if (loadingMore) return
        val requestedFeed = selectedFeed
        val requestedTopicId = selectedTopicId.takeIf { requestedFeed == FeedType.FOR_YOU }
        val requestGeneration = feedSelectionGeneration
        val accessToken = sessionRepository.sessionOrNull()?.accessToken
        loadingMore = true
        loadMoreError = null
        executor.execute {
            val next = repository.load(requestedFeed, accessToken, cursor, requestedTopicId)
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
    LaunchedEffect(accountUser?.id) { if (!isGuest) loadTopics(sessionRepository.sessionOrNull()?.accessToken) }

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

    if (showingPayment) {
        val orderId = checkoutOrderId
        if (orderId != null) {
            HingeSafeContent {
                CheckoutPaymentScreen(
                    repository = checkoutRepository,
                    executor = executor,
                    receipt = CheckoutReceipt(
                        checkoutId = checkoutId ?: orderId,
                        payableOrderId = orderId,
                        total = com.nantty.android.data.WalletMoney(checkoutTotalMinor, checkoutCurrency),
                        orderCount = checkoutOrderCount,
                    ),
                    onBack = { showingPayment = false; showingCart = true },
                    onAuthenticationRequired = onSignOut,
                    onViewOrders = { showingPayment = false; destination = Destination.Orders },
                )
            }
        }
        return
    }

    if (showingCheckout) {
        HingeSafeContent {
            CheckoutScreen(
                repository = checkoutRepository,
                executor = executor,
                onBack = { showingCheckout = false; showingCart = true },
                onAuthenticationRequired = onSignOut,
                onCheckoutCreated = { receipt ->
                    checkoutId = receipt.checkoutId
                    checkoutOrderId = receipt.payableOrderId
                    checkoutTotalMinor = receipt.total.amountMinor
                    checkoutCurrency = receipt.total.currency
                    checkoutOrderCount = receipt.orderCount
                    showingCheckout = false
                    showingPayment = true
                    showingCart = false
                },
            )
        }
        return
    }

    if (showingCart) {
        HingeSafeContent {
            CartScreen(
                repository = cartRepository,
                executor = executor,
                onBack = { showingCart = false },
                onAuthenticationRequired = onSignOut,
                onProceedToCheckout = { showingCart = false; showingCheckout = true },
            )
        }
        return
    }

    HingeSafeContent {
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        val adaptiveInfo = currentWindowAdaptiveInfoV2()
        val windowSizeClass = adaptiveInfo.windowSizeClass
        val hasExpandedWidth = windowSizeClass.isWidthAtLeastBreakpoint(
            WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND,
        )
        val showMartCategoryPane = shouldShowMartCategoryPane(
            windowSizeClass = windowSizeClass,
            isTabletop = adaptiveInfo.windowPosture.isTabletop,
            hasVerticalHinge = adaptiveInfo.windowPosture.separatingVerticalHingeBounds.isNotEmpty(),
        )
        val useNavigationRail = shouldUseNavigationRail(
            windowSizeClass = windowSizeClass,
            isTabletop = adaptiveInfo.windowPosture.isTabletop,
        )
        if (useNavigationRail) {
            Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.Center) {
                NavigationRail(Modifier.fillMaxHeight(), containerColor = MaterialTheme.colorScheme.background) {
                    Spacer(Modifier.height(18.dp))
                    BrandMark()
                    Spacer(Modifier.height(28.dp))
                    visibleDestinations(isGuest).forEach { item ->
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
                        .widthIn(max = if (hasExpandedWidth) 680.dp else 620.dp)
                        .fillMaxHeight(),
                ) {
                    AppHeader(onRefresh = ::refresh, onOpenMart = { destination = Destination.Mart }, onOpenCart = { if (isGuest) onRequireSignIn() else showingCart = true }, onOpenOrders = { if (isGuest) onRequireSignIn() else destination = Destination.Orders }, accountUser = accountUser, onSignOut = if (isGuest) onRequireSignIn else onSignOut)
                    if (destination == Destination.Feed || destination == Destination.Mart) {
                        FeedMartSectionTabs(
                            selectedMart = destination == Destination.Mart,
                            onSelectMart = { destination = if (it) Destination.Mart else Destination.Feed },
                        )
                    }
                    if (destination == Destination.Feed && !isGuest) {
                        FeedTopicSelector(feedTopics, selectedTopicId, topicsLoading, topicsError, ::selectTopic) {
                            loadTopics(sessionRepository.sessionOrNull()?.accessToken)
                        }
                    }
                    MainContent(destination, result, loading, selectedFeed = selectedFeed, canViewFollowing = !isGuest, onSelectFeed = ::selectFeed, onSignInRequired = onRequireSignIn, onReauthenticate = onSignOut, onRefresh = ::refresh, onCreatePost = { if (isGuest) onRequireSignIn() else showingComposer = true }, onOpenPost = { selectedPostId = it }, onOpenProfile = { selectedProfileId = it }, onOpenProduct = { pendingMartProductId = it; destination = Destination.Mart }, onLike = { if (isGuest) onRequireSignIn() else toggleFeedLike(it) }, onRepost = { if (isGuest) onRequireSignIn() else toggleFeedRepost(it) }, onSave = { if (isGuest) onRequireSignIn() else toggleFeedSaved(it) }, onShare = ::shareFeedPost, interactionMessage = interactionMessage, savingPostId = savingPostId, loadingMore = loadingMore, loadMoreError = loadMoreError, onLoadMore = ::loadMore, walletRepository = walletRepository, walletAccountKey = accountUser?.id, onOpenWallet = { if (isGuest) onRequireSignIn() else destination = Destination.Wallet }, buyerOrdersRepository = buyerOrdersRepository, currentProfileRepository = currentProfileRepository, ioExecutor = executor, notificationsRepository = notificationsRepository, accountNotificationSettingsRepository = accountNotificationSettingsRepository, onNotificationReauthenticate = onSignOut, searchRepository = searchRepository, exploreRepository = exploreRepository, publicProfileRepository = publicProfileRepository, messagesRepository = messagesRepository, savedPostsRepository = savedPostsRepository, martRepository = martRepository, showMartCategoryPane = showMartCategoryPane, initialMartProductId = pendingMartProductId, onInitialMartProductHandled = { pendingMartProductId = null }, onOpenSavedPosts = { if (isGuest) onRequireSignIn() else destination = Destination.Saved }, onBackFromSavedPosts = { destination = Destination.Feed }, onBackFromOrders = { destination = Destination.Feed }, onOpenMessages = { if (isGuest) onRequireSignIn() else destination = Destination.Messages }, onOpenOrders = { if (isGuest) onRequireSignIn() else destination = Destination.Orders })
                }
                if (hasExpandedWidth) {
                    Column(Modifier.width(280.dp).padding(start = 24.dp, top = 28.dp)) {
                        Text("Your Nantty", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(8.dp))
                        Text("A calmer corner of your social world.", color = MaterialTheme.colorScheme.secondary)
                    }
                }
            }
        } else {
            Column(Modifier.fillMaxSize()) {
                AppHeader(onRefresh = ::refresh, onOpenMart = { destination = Destination.Mart }, onOpenCart = { if (isGuest) onRequireSignIn() else showingCart = true }, onOpenOrders = { if (isGuest) onRequireSignIn() else destination = Destination.Orders }, accountUser = accountUser, onSignOut = if (isGuest) onRequireSignIn else onSignOut)
                if (destination == Destination.Feed || destination == Destination.Mart) {
                    FeedMartSectionTabs(
                        selectedMart = destination == Destination.Mart,
                        onSelectMart = { destination = if (it) Destination.Mart else Destination.Feed },
                    )
                }
                if (destination == Destination.Feed && !isGuest) {
                    FeedTopicSelector(feedTopics, selectedTopicId, topicsLoading, topicsError, ::selectTopic) {
                        loadTopics(sessionRepository.sessionOrNull()?.accessToken)
                    }
                }
                    MainContent(destination, result, loading, selectedFeed = selectedFeed, canViewFollowing = !isGuest, onSelectFeed = ::selectFeed, onSignInRequired = onRequireSignIn, onReauthenticate = onSignOut, onRefresh = ::refresh, onCreatePost = { if (isGuest) onRequireSignIn() else showingComposer = true }, modifier = Modifier.weight(1f), onOpenPost = { selectedPostId = it }, onOpenProfile = { selectedProfileId = it }, onOpenProduct = { pendingMartProductId = it; destination = Destination.Mart }, onLike = { if (isGuest) onRequireSignIn() else toggleFeedLike(it) }, onRepost = { if (isGuest) onRequireSignIn() else toggleFeedRepost(it) }, onSave = { if (isGuest) onRequireSignIn() else toggleFeedSaved(it) }, onShare = ::shareFeedPost, interactionMessage = interactionMessage, savingPostId = savingPostId, loadingMore = loadingMore, loadMoreError = loadMoreError, onLoadMore = ::loadMore, walletRepository = walletRepository, walletAccountKey = accountUser?.id, onOpenWallet = { if (isGuest) onRequireSignIn() else destination = Destination.Wallet }, buyerOrdersRepository = buyerOrdersRepository, currentProfileRepository = currentProfileRepository, ioExecutor = executor, notificationsRepository = notificationsRepository, accountNotificationSettingsRepository = accountNotificationSettingsRepository, onNotificationReauthenticate = onSignOut, searchRepository = searchRepository, exploreRepository = exploreRepository, publicProfileRepository = publicProfileRepository, messagesRepository = messagesRepository, savedPostsRepository = savedPostsRepository, martRepository = martRepository, showMartCategoryPane = showMartCategoryPane, initialMartProductId = pendingMartProductId, onInitialMartProductHandled = { pendingMartProductId = null }, onOpenSavedPosts = { if (isGuest) onRequireSignIn() else destination = Destination.Saved }, onBackFromSavedPosts = { destination = Destination.Feed }, onBackFromOrders = { destination = Destination.Feed }, onOpenMessages = { if (isGuest) onRequireSignIn() else destination = Destination.Messages }, onOpenOrders = { if (isGuest) onRequireSignIn() else destination = Destination.Orders })
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                    visibleDestinations(isGuest).forEach { item ->
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

