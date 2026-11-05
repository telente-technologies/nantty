package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.nantty.android.data.AccountUser
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.CheckoutReceipt
import com.nantty.android.data.FeedPost
import com.nantty.android.data.FeedRepository
import com.nantty.android.data.FollowRequestsRepository
import com.nantty.android.data.FeedResult
import com.nantty.android.data.FeedTopic
import com.nantty.android.data.FeedTopicsResult
import com.nantty.android.data.FeedType
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.appendUniqueFeedPosts
import java.util.concurrent.Executors

@Composable
internal fun SignedInApp(
    accountUser: AccountUser?,
    isGuest: Boolean,
    sessionRepository: AccountSessionRepository,
    onRequireSignIn: () -> Unit,
    onRequireFollowingSignIn: () -> Unit = onRequireSignIn,
    initialFollowingAfterSignIn: Boolean = false,
    onInitialFollowingHandled: () -> Unit = {},
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
    var selectedConnectionsUserId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedConnectionsTab by rememberSaveable { mutableStateOf("followers") }
    var showingConnections by rememberSaveable { mutableStateOf(false) }
    var pendingMessageConversation by remember { mutableStateOf<InboxConversation?>(null) }
    var profileOpenedFromConnections by rememberSaveable { mutableStateOf(false) }
    var selectedStoreId by rememberSaveable { mutableStateOf<String?>(null) }
    var searchScope by rememberSaveable { mutableStateOf("global") }
    var searchScopeLabel by rememberSaveable { mutableStateOf("Everywhere") }
    var showingCart by rememberSaveable { mutableStateOf(false) }
    var showingCheckout by rememberSaveable { mutableStateOf(false) }
    var showingPayment by rememberSaveable { mutableStateOf(false) }
    var checkoutId by rememberSaveable { mutableStateOf<String?>(null) }
    var checkoutOrderId by rememberSaveable { mutableStateOf<String?>(null) }
    var checkoutTotalMinor by rememberSaveable { mutableStateOf(0L) }
    var checkoutCurrency by rememberSaveable { mutableStateOf("") }
    var checkoutOrderCount by rememberSaveable { mutableStateOf(0) }
    var pendingMartProductId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingMartCategoryId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingMartCategoryName by rememberSaveable { mutableStateOf<String?>(null) }
    var showingComposer by rememberSaveable { mutableStateOf(false) }
    SignedInWidgetDestinationEffect(
        requestedDestination = requestedWidgetDestination,
        isGuest = isGuest,
        onRequireSignIn = onRequireSignIn,
        onSelectDestination = { destination = it },
        onShowComposer = { showingComposer = it },
        onHandled = onWidgetDestinationHandled,
    )
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
    val repositories = rememberSignedInRepositories(sessionRepository)
    val (
        walletRepository,
        cartRepository,
        checkoutRepository,
        buyerOrdersRepository,
        disputeRepository,
        notificationsRepository,
        accountNotificationSettingsRepository,
        messagesRepository,
        searchRepository,
        exploreRepository,
        savedPostsRepository,
        martRepository,
        publicProfileRepository,
        storeRepository,
        currentProfileRepository,
        followRequestsRepository,
        sellerWorkspaceRepository,
        creatorWorkspaceRepository,
        brandProfilesRepository,
        adsWorkspaceRepository,
        profileImagesRepository,
        privateMediaUploadsRepository,
    ) = repositories
    val businessContent = buildSignedInBusinessContent(
        repositories = repositories,
        executor = executor,
        onReauthenticate = onSignOut,
        onConversationStarted = { conversation ->
            pendingMessageConversation = conversation
            destination = Destination.Messages
        },
        onMessageFailure = { message, authenticationRequired -> if (authenticationRequired) onSignOut() else interactionMessage = message },
        onOpenBuyerProfile = { selectedProfileId = it; profileOpenedFromConnections = false },
        onBack = { destination = Destination.Profile },
    )

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

    val feedActions = SignedInFeedActions(
        executor = executor,
        postRepository = { PostDetailRepository(sessionProvider = sessionRepository::sessionOrNull) },
        onMessage = { interactionMessage = it },
        onSaving = { savingPostId = it },
        isSaving = { savingPostId == it },
        applyInteraction = { post, liked, reposted, bookmarked -> applyFeedInteraction(post, liked, reposted, bookmarked) },
        refresh = ::refresh,
    )

    LaunchedEffect(Unit) { refresh() }
    LaunchedEffect(accountUser?.id, isGuest, initialFollowingAfterSignIn) {
        if (!isGuest && initialFollowingAfterSignIn) {
            selectFeed(FeedType.FOLLOWING)
            onInitialFollowingHandled()
        }
    }
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

    selectedStoreId?.let { storeId ->
        HingeSafeContent {
            PublicStoreScreen(
                storeId = storeId,
                repository = storeRepository,
                executor = executor,
                onBack = { selectedStoreId = null },
                onRequireSignIn = onRequireSignIn,
                onOpenProduct = { productId ->
                    selectedStoreId = null
                    pendingMartProductId = productId
                    destination = Destination.Mart
                },
            )
        }
        return
    }

    selectedProfileId?.takeIf { !showingConnections }?.let { profileId ->
        PublicProfileDestination(
            userId = profileId,
            repository = publicProfileRepository,
            executor = executor,
            onBack = {
                selectedProfileId = null
                if (profileOpenedFromConnections) showingConnections = true
                profileOpenedFromConnections = false
            },
            onOpenPost = { selectedPostId = it },
            onSearchProfile = { userId, username ->
                selectedProfileId = null
                searchScope = "profile:$userId"
                searchScopeLabel = "@" + username.removePrefix("@")
                destination = Destination.Discover
            },
            onOpenConnections = { userId, tab ->
                selectedConnectionsUserId = userId
                selectedConnectionsTab = tab
                showingConnections = true
            },
        )
        return
    }

    if (showingConnections && selectedConnectionsUserId != null) {
        ProfileConnectionsOverlay(
            userId = selectedConnectionsUserId!!,
            initialTab = selectedConnectionsTab,
            repository = publicProfileRepository,
            executor = executor,
            messagesRepository = messagesRepository,
            onBack = { showingConnections = false; selectedConnectionsUserId = null },
            onOpenProfile = { userId ->
                selectedProfileId = userId
                profileOpenedFromConnections = true
                showingConnections = false
            },
            onRequireSignIn = onRequireSignIn,
            onOpenConversation = { conversation -> pendingMessageConversation = conversation; showingConnections = false; selectedConnectionsUserId = null; destination = Destination.Messages },
        )
        return
    }

    if (showingPayment) {
        SignedInPaymentDestination(
            orderId = checkoutOrderId,
            checkoutId = checkoutId,
            totalMinor = checkoutTotalMinor,
            currency = checkoutCurrency,
            orderCount = checkoutOrderCount,
            repository = checkoutRepository,
            executor = executor,
            onBack = { showingPayment = false; showingCart = true },
            onAuthenticationRequired = onSignOut,
            onViewOrders = { showingPayment = false; destination = Destination.Orders },
        )
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

    SignedInNavigationShell(
        destination = destination,
        isGuest = isGuest,
        accountUser = accountUser,
        onSelectDestination = { destination = it },
        onRefresh = ::refresh,
        onOpenMart = { destination = Destination.Mart },
        onSelectMart = { destination = if (it) Destination.Mart else Destination.Feed },
        onOpenCart = { if (isGuest) onRequireSignIn() else showingCart = true },
        onOpenOrders = { if (isGuest) onRequireSignIn() else destination = Destination.Orders },
        onSignOut = if (isGuest) onRequireSignIn else onSignOut,
        topicSelector = {
            FeedTopicSelector(feedTopics, selectedTopicId, topicsLoading, topicsError, ::selectTopic) {
                loadTopics(sessionRepository.sessionOrNull()?.accessToken)
            }
        },
        destinationContent = { contentModifier, showMartCategoryPane ->
            MainContent(
                destination, result, loading,
                selectedFeed = selectedFeed,
                canViewFollowing = !isGuest,
                onSelectFeed = ::selectFeed,
                onSignInRequired = onRequireSignIn,
                onFollowingSignInRequired = onRequireFollowingSignIn,
                onReauthenticate = onSignOut,
                onRefresh = ::refresh,
                onCreatePost = { if (isGuest) onRequireSignIn() else showingComposer = true },
                modifier = contentModifier,
                onOpenPost = { selectedPostId = it },
                onOpenProfile = { selectedProfileId = it; profileOpenedFromConnections = false },
                onOpenConnections = { userId, tab ->
                    selectedConnectionsUserId = userId
                    selectedConnectionsTab = tab
                    showingConnections = true
                },
                onSearchCurrentProfile = { accountId, username ->
                    searchScope = "profile:$accountId"
                    searchScopeLabel = "@${username.removePrefix("@")}"
                    destination = Destination.Discover
                },
                searchScope = searchScope,
                searchScopeLabel = searchScopeLabel,
                onSearchScopeChanged = { scope, label ->
                    searchScope = scope
                    searchScopeLabel = label
                },
                onOpenProduct = { pendingMartProductId = it; destination = Destination.Mart },
                onOpenStore = { selectedStoreId = it },
                onOpenCategory = { categoryId, name ->
                    pendingMartCategoryId = categoryId
                    pendingMartCategoryName = name
                    destination = Destination.Mart
                },
                onLike = { if (isGuest) onRequireSignIn() else feedActions.like(it) },
                onRepost = { if (isGuest) onRequireSignIn() else feedActions.repost(it) },
                onSave = { if (isGuest) onRequireSignIn() else feedActions.save(it) },
                onShare = { feedActions.share(shareContext, it) },
                interactionMessage = interactionMessage,
                savingPostId = savingPostId,
                loadingMore = loadingMore,
                loadMoreError = loadMoreError,
                onLoadMore = ::loadMore,
                walletRepository = walletRepository,
                buyerOrdersRepository = buyerOrdersRepository,
                disputeRepository = disputeRepository,
                privateMediaUploadsRepository = privateMediaUploadsRepository,
                currentProfileRepository = currentProfileRepository,
                profileImagesRepository = profileImagesRepository,
                followRequestsRepository = followRequestsRepository,
                ioExecutor = executor,
                notificationsRepository = notificationsRepository,
                accountNotificationSettingsRepository = accountNotificationSettingsRepository,
                onNotificationReauthenticate = onSignOut,
                searchRepository = searchRepository,
                exploreRepository = exploreRepository,
                publicProfileRepository = publicProfileRepository,
                messagesRepository = messagesRepository,
                initialMessageConversation = pendingMessageConversation,
                onInitialMessageConversationHandled = { pendingMessageConversation = null },
                savedPostsRepository = savedPostsRepository,
                martRepository = martRepository,
                storeRepository = storeRepository,
                showMartCategoryPane = showMartCategoryPane,
                initialMartProductId = pendingMartProductId,
                onInitialMartProductHandled = { pendingMartProductId = null },
                initialMartCategoryId = pendingMartCategoryId,
                initialMartCategoryName = pendingMartCategoryName,
                onInitialMartCategoryHandled = {
                    pendingMartCategoryId = null
                    pendingMartCategoryName = null
                },
                onOpenSavedPosts = { if (isGuest) onRequireSignIn() else destination = Destination.Saved },
                onBackFromSavedPosts = { destination = Destination.Feed },
                onBackFromOrders = { destination = Destination.Feed },
                onBackFromFollowRequests = { destination = Destination.Profile },
                onOpenMessages = { if (isGuest) onRequireSignIn() else destination = Destination.Messages },
                onOpenOrders = { if (isGuest) onRequireSignIn() else destination = Destination.Orders },
                onOpenFollowRequests = { if (isGuest) onRequireSignIn() else destination = Destination.FollowRequests },
                onOpenBusinessTools = { if (isGuest) onRequireSignIn() else destination = Destination.Business },
                businessContent = businessContent,
            )
        },
    )

}

