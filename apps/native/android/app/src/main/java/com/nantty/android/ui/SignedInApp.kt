package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.nantty.android.data.AccountUser
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.ChatPasscodeRepository
import com.nantty.android.data.FeedRepository
import com.nantty.android.data.FollowRequestsRepository
import com.nantty.android.data.FeedResult
import com.nantty.android.data.FeedType
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.LiveCoinTipRepository
import com.nantty.android.data.LiveSessionsRepository
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.PublicBrandRepository
import com.nantty.android.data.SpacesRepository
import com.nantty.android.data.StoriesRepository
import com.nantty.android.data.SoundsRepository
import com.nantty.android.notifications.PushTapTarget
import java.util.concurrent.Executors

@Composable
internal fun SignedInApp(
    accountUser: AccountUser?,
    isGuest: Boolean,
    sessionRepository: AccountSessionRepository,
    onRequireSignIn: () -> Unit,
    onRequireSignInWithAction: ((() -> Unit) -> Unit) = { onRequireSignIn() },
    onRequireFollowingSignIn: () -> Unit = onRequireSignIn,
    initialFollowingAfterSignIn: Boolean = false,
    onInitialFollowingHandled: () -> Unit = {},
    onSignOut: () -> Unit,
    repository: FeedRepository,
    requestedWidgetDestination: String?,
    onWidgetDestinationHandled: () -> Unit,
    requestedNotificationTarget: PushTapTarget? = null,
    onNotificationTargetHandled: () -> Unit = {},
    requestedGroupInvitationToken: String? = null, onGroupInvitationTokenHandled: () -> Unit = {}, requestedChannelInvitationToken: String? = null, onChannelInvitationTokenHandled: () -> Unit = {},
) {
    val shareContext = LocalContext.current.applicationContext
    var destination by rememberSaveable { mutableStateOf(Destination.Feed) }
    val countryPreferenceNavigation = rememberCountryPreferenceNavigation(destination) { destination = it }
    val selectedFeedState = rememberSaveable { mutableStateOf(FeedType.FOR_YOU) }
    var selectedFeed by selectedFeedState
    val selectedTopicState = rememberSaveable { mutableStateOf<String?>(null) }
    var selectedTopicId by selectedTopicState
    val feedSelectionGenerationState = rememberSaveable { mutableStateOf(0) }
    var selectedPostId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedPostCommentId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedProfileId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedConnectionsUserId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedConnectionsTab by rememberSaveable { mutableStateOf("followers") }
    var showingConnections by rememberSaveable { mutableStateOf(false) }
    fun openConnections(userId: String, tab: String) {
        selectedConnectionsUserId = userId
        selectedConnectionsTab = tab
        showingConnections = true
    }
    var pendingMessageConversation by remember { mutableStateOf<InboxConversation?>(null) }
    var pendingNotificationConversationId by rememberSaveable { mutableStateOf<String?>(null) }; var pendingNotificationOrderId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingGroupInvitations by rememberSaveable { mutableStateOf(false) }; var pendingChannelInvitations by rememberSaveable { mutableStateOf(false) }
    val pendingGroupInvitationToken = rememberGroupInvitationLinkRoute(requestedGroupInvitationToken, onGroupInvitationTokenHandled) { destination = Destination.Messages }
    val channelInvitationNavigation = rememberChannelInvitationNavigation(requestedChannelInvitationToken, onChannelInvitationTokenHandled) { destination = Destination.Messages }
    var pendingSupportTicketId by rememberSaveable { mutableStateOf<String?>(null) }; var pendingNotificationClipId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingNotificationDisputeId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingLiveId by rememberSaveable { mutableStateOf<String?>(null) }
    var messagesRefreshGeneration by rememberSaveable { mutableStateOf(0) }
    var profileOpenedFromConnections by rememberSaveable { mutableStateOf(false) }
    var selectedStoreId by rememberSaveable { mutableStateOf<String?>(null) }; var selectedBrandId by rememberSaveable { mutableStateOf<String?>(null) }
    var searchScope by rememberSaveable { mutableStateOf("global") }
    var searchScopeLabel by rememberSaveable { mutableStateOf("Everywhere") }
    val purchaseState = rememberSaveable(saver = SignedInPurchaseState.Saver) { SignedInPurchaseState() }
    var pendingMartProductId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingMartCategoryId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingMartCategoryName by rememberSaveable { mutableStateOf<String?>(null) }
    var returnToDiscoverAfterCategory by rememberSaveable { mutableStateOf(false) }
    val destinationStateHolder = rememberSaveableStateHolder()
    var showingComposer by rememberSaveable { mutableStateOf(false) }
    SignedInWidgetDestinationEffect(
        requestedDestination = requestedWidgetDestination,
        isGuest = isGuest,
        onRequireSignIn = onRequireSignIn,
        onSelectDestination = { destination = it },
        onShowComposer = { showingComposer = it },
        onHandled = onWidgetDestinationHandled,
    )
    SignedInPushTargetEffect(
        target = requestedNotificationTarget,
        isGuest = isGuest,
        onRequireSignIn = onRequireSignIn,
        onHandled = onNotificationTargetHandled,
        onOpenPost = { postId, commentId -> selectedPostId = postId; selectedPostCommentId = commentId; destination = Destination.Feed },
        onOpenProfile = { selectedProfileId = it; profileOpenedFromConnections = false },
        onOpenConversation = { pendingNotificationConversationId = it; destination = Destination.Messages },
        onOpenOrder = { pendingNotificationOrderId = it; destination = Destination.Orders },
        onSelectDestination = { destination = it },
        onOpenGroupInvitations = { token -> if (token == null) pendingGroupInvitations = true else pendingGroupInvitationToken.value = token; destination = Destination.Messages },
        onOpenChannelInvitations = { token -> if (token == null) pendingChannelInvitations = true else channelInvitationNavigation.open(token); destination = Destination.Messages },
        onOpenSupportTicket = { pendingSupportTicketId = it; destination = Destination.SupportRequests },
        onOpenDispute = { pendingNotificationDisputeId = it; destination = Destination.DisputeDetail },
        onOpenClip = { pendingNotificationClipId = it; destination = Destination.Clips },
        onOpenLive = { pendingLiveId = it; destination = Destination.Live },
    )
    val feedResultState = remember { mutableStateOf<FeedResult?>(null) }
    var result by feedResultState
    val feedLoadingState = remember { mutableStateOf(false) }
    var loading by feedLoadingState
    val feedLoadingMoreState = remember { mutableStateOf(false) }
    var loadingMore by feedLoadingMoreState
    val feedLoadMoreErrorState = remember { mutableStateOf<String?>(null) }
    var loadMoreError by feedLoadMoreErrorState
    val feedInteractionMessageState = remember { mutableStateOf<String?>(null) }
    var interactionMessage by feedInteractionMessageState
    var savingPostId by remember { mutableStateOf<String?>(null) }
    val executor = remember { Executors.newSingleThreadExecutor() }
    val feedController = remember(repository, sessionRepository, executor) {
        SignedInFeedController(
            executor = executor,
            accessToken = { sessionRepository.sessionOrNull()?.accessToken },
            loadPage = repository::load,
            selection = SignedInFeedSelectionState(selectedFeedState, selectedTopicState, feedSelectionGenerationState),
            content = SignedInFeedContentState(
                result = feedResultState,
                loading = feedLoadingState,
                loadingMore = feedLoadingMoreState,
                loadMoreError = feedLoadMoreErrorState,
                interactionMessage = feedInteractionMessageState,
            ),
        )
    }
    val feedTopics = rememberSignedInFeedTopics(repository, executor)
    val repositories = rememberSignedInRepositories(sessionRepository)
    val publicBrandRepository = remember(sessionRepository) {
        PublicBrandRepository(sessionProvider = sessionRepository::sessionOrNull)
    }
    val spacesRepository = remember { SpacesRepository() }
    val liveSessionsRepository = remember(sessionRepository) {
        LiveSessionsRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val liveCoinTipRepository = remember(sessionRepository) {
        LiveCoinTipRepository(
            sessionProvider = sessionRepository::sessionOrNull,
            refreshSessionProvider = sessionRepository::refreshSession,
        )
    }
    val storiesRepository = remember(sessionRepository) { StoriesRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val soundsRepository = remember(sessionRepository) { SoundsRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val postDetailRepository = remember(sessionRepository) { PostDetailRepository(sessionProvider = sessionRepository::sessionOrNull) }
    val chatPasscodeRepository = remember(shareContext) { ChatPasscodeRepository(shareContext) }
    val (
        walletRepository,
        _,
        _,
        buyerOrdersRepository,
        productReviewsRepository,
        disputeRepository,
        notificationsRepository,
        accountNotificationSettingsRepository,
        countryPreferenceRepository,
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
        onConversationStarted = { pendingMessageConversation = it; destination = Destination.Messages },
        onMessageFailure = { message, authenticationRequired -> if (authenticationRequired) onSignOut() else interactionMessage = message },
        onOpenBuyerProfile = { selectedProfileId = it; profileOpenedFromConnections = false },
        onOpenCountryPreferences = countryPreferenceNavigation.open,
        onBack = { destination = Destination.Profile },
    )
    val purchaseDestination = purchaseState.destination
    if (purchaseDestination != null) {
        SignedInPurchaseDestinationContent(
            state = purchaseState,
            repositories = repositories,
            executor = executor,
            onAuthenticationRequired = onSignOut,
            onReturnToOrders = { destination = Destination.Orders },
            onContinueShopping = { destination = Destination.Mart },
            onOpenStore = { selectedStoreId = it },
            onOpenProduct = { pendingMartProductId = it; destination = Destination.Mart },
        )
        return
    }
    fun refresh() = feedController.refresh()
    fun selectFeed(feed: FeedType) = feedController.selectFeed(feed)
    fun selectTopic(topicId: String?) = feedController.selectTopic(topicId)
    fun loadMore() = feedController.loadMore()

    val feedActions = SignedInFeedActions(
        executor = executor,
        postRepository = { PostDetailRepository(sessionProvider = sessionRepository::sessionOrNull) },
        onMessage = { interactionMessage = it },
        onSaving = { savingPostId = it },
        isSaving = { savingPostId == it },
        applyInteraction = { post, liked, reposted, bookmarked -> feedController.applyInteraction(post, liked, reposted, bookmarked) },
        refresh = ::refresh,
    )

    LaunchedEffect(Unit) { refresh() }
    LaunchedEffect(accountUser?.id, isGuest, initialFollowingAfterSignIn) {
        if (!isGuest && initialFollowingAfterSignIn) {
            selectFeed(FeedType.FOLLOWING)
            onInitialFollowingHandled()
        }
    }
    LaunchedEffect(accountUser?.id) {
        if (!isGuest) feedTopics.controller.load(sessionRepository.sessionOrNull()?.accessToken)
    }

    if (SignedInOverlayDestinations(
            selection = SignedInOverlaySelection(
                showingComposer = showingComposer,
                selectedPostId = selectedPostId,
                selectedPostCommentId = selectedPostCommentId,
                selectedStoreId = selectedStoreId,
                selectedBrandId = selectedBrandId,
                isGuest = isGuest,
                selectedProfileId = selectedProfileId,
                showingConnections = showingConnections,
                selectedConnectionsUserId = selectedConnectionsUserId,
                selectedConnectionsTab = selectedConnectionsTab,
            ),
            dependencies = SignedInOverlayDependencies(
                sessionRepository = sessionRepository,
                publicProfileRepository = publicProfileRepository,
                storeRepository = storeRepository,
                brandRepository = publicBrandRepository,
                messagesRepository = messagesRepository,
                storiesRepository = storiesRepository,
                soundsRepository = soundsRepository,
                storyMediaRepository = privateMediaUploadsRepository,
                executor = executor,
            ),
            actions = SignedInOverlayActions(
                cancelComposer = { showingComposer = false },
                publishedPost = { postId -> showingComposer = false; selectedPostId = postId; refresh() },
                storyPublished = { showingComposer = false; messagesRefreshGeneration++; destination = Destination.Messages },
                backFromPost = { selectedPostId = null; selectedPostCommentId = null; refresh() },
                backFromStore = { selectedStoreId = null },
                backFromBrand = { selectedBrandId = null },
                openStore = { storeId -> selectedBrandId = null; selectedStoreId = storeId },
                openProduct = { productId ->
                    selectedStoreId = null
                    selectedBrandId = null
                    pendingMartProductId = productId
                    destination = Destination.Mart
                },
                backFromProfile = {
                    selectedProfileId = null
                    if (profileOpenedFromConnections) showingConnections = true
                    profileOpenedFromConnections = false
                },
                openProfilePost = { selectedPostId = it },
                searchProfile = { userId, username ->
                    selectedProfileId = null
                    searchScope = "profile:$userId"
                    searchScopeLabel = "@" + username.removePrefix("@")
                    destination = Destination.Discover
                },
                openConnections = ::openConnections,
                openConnectionProfile = { userId ->
                    selectedProfileId = userId
                    profileOpenedFromConnections = true
                    showingConnections = false
                },
                backFromConnections = { showingConnections = false; selectedConnectionsUserId = null },
                requireSignIn = onRequireSignIn,
                requireSignInWithAction = onRequireSignInWithAction,
                openConversation = { conversation ->
                    pendingMessageConversation = conversation
                    showingConnections = false
                    selectedConnectionsUserId = null
                    destination = Destination.Messages
                },
            ),
        )) return

    SignedInNavigationShell(
        destination = destination,
        isGuest = isGuest,
        accountUser = accountUser,
        onSelectDestination = { destination = it },
        onRefresh = ::refresh,
        onOpenMart = { destination = Destination.Mart },
        onSelectMart = { destination = if (it) Destination.Mart else Destination.Feed },
        onOpenCart = { if (isGuest) onRequireSignIn() else purchaseState.openCart() },
        onOpenOrders = { if (isGuest) onRequireSignIn() else destination = Destination.Orders },
        onSignOut = if (isGuest) onRequireSignIn else onSignOut,
        topicSelector = {
            SignedInFeedTopicSelector(feedTopics.state.value, selectedTopicId, ::selectTopic) {
                feedTopics.controller.load(sessionRepository.sessionOrNull()?.accessToken)
            }
        },
        destinationContent = { contentModifier, showMartCategoryPane ->
            destinationStateHolder.SaveableStateProvider(destination.name) {
                ChatLockBoundary(accountUser?.id, isGuest, destination, chatPasscodeRepository, executor, onSignOut) { onChatPasscodeUpdated ->
                MainContent(
                destination, result, loading,
                selectedFeed = selectedFeed,
                canViewFollowing = !isGuest,
                onSelectFeed = ::selectFeed,
                onSignInRequired = onRequireSignIn,
                onSignInRequiredWithAction = onRequireSignInWithAction,
                onFollowingSignInRequired = onRequireFollowingSignIn,
                onReauthenticate = onSignOut,
                onRefresh = ::refresh,
                onCreatePost = { if (isGuest) onRequireSignIn() else showingComposer = true },
                modifier = contentModifier,
                onOpenPost = { selectedPostId = it },
                onOpenPostComment = { postId, commentId ->
                    selectedPostId = postId
                    selectedPostCommentId = commentId
                },
                onOpenProfile = { selectedProfileId = it; profileOpenedFromConnections = false },
                onOpenConnections = ::openConnections,
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
                onOpenBrand = { brandId -> selectedStoreId = null; selectedBrandId = brandId },
                onOpenCategory = { categoryId, name ->
                    pendingMartCategoryId = categoryId
                    pendingMartCategoryName = name
                    returnToDiscoverAfterCategory = destination == Destination.Discover
                    destination = Destination.Mart
                },
                onLike = { if (isGuest) onRequireSignIn() else feedActions.like(it) },
                onRepost = { if (isGuest) onRequireSignIn() else feedActions.repost(it) },
                onSave = { if (isGuest) onRequireSignIn() else feedActions.save(it) },
                onShare = { feedActions.share(shareContext, it) },
                interactionMessage = interactionMessage,
                onMessageFailure = { message, authenticationRequired ->
                    if (authenticationRequired) onSignOut() else interactionMessage = message
                },
                savingPostId = savingPostId,
                loadingMore = loadingMore,
                loadMoreError = loadMoreError,
                onLoadMore = ::loadMore,
                walletRepository = walletRepository,
                buyerOrdersRepository = buyerOrdersRepository,
                productReviewsRepository = productReviewsRepository,
                disputeRepository = disputeRepository,
                privateMediaUploadsRepository = privateMediaUploadsRepository,
                currentProfileRepository = currentProfileRepository,
                profileImagesRepository = profileImagesRepository,
                followRequestsRepository = followRequestsRepository,
                ioExecutor = executor,
                notificationsRepository = notificationsRepository,
                accountNotificationSettingsRepository = accountNotificationSettingsRepository,
                countryPreferenceRepository = countryPreferenceRepository,
                countryPreferenceNavigation = countryPreferenceNavigation,
                chatNotificationSettingsRepository = repositories.chatNotificationSettings,
                chatPasscodeRepository = chatPasscodeRepository,
                onOpenChatNotificationSettings = { destination = Destination.ChatNotificationSettings },
                onOpenChatPasscodeSettings = { destination = Destination.ChatPasscode },
                onChatPasscodeUpdated = onChatPasscodeUpdated,
                onOpenBlockedAccounts = { publicProfileRepository.viewerId()?.let { openConnections(it, "blocked") } },
                messagesRefreshGeneration = messagesRefreshGeneration,
                onChatNotificationsSaved = { messagesRefreshGeneration++ },
                onNotificationReauthenticate = onSignOut,
                searchRepository = searchRepository,
                exploreRepository = exploreRepository,
                publicProfileRepository = publicProfileRepository,
                messagesRepository = messagesRepository,
                supportTicketRepository = repositories.supportTickets,
                spacesRepository = spacesRepository,
                liveSessionsRepository = liveSessionsRepository,
                liveCoinTipRepository = liveCoinTipRepository,
                initialLiveId = pendingLiveId,
                onBackFromLive = { pendingLiveId = null; destination = Destination.Feed },
                clipsRepository = repositories.clips,
                clipWatchTrackingRepository = repositories.clipWatchTracking,
                storiesRepository = storiesRepository,
                postDetailRepository = postDetailRepository,
                spacesAccessToken = sessionRepository.sessionOrNull()?.accessToken,
                spacesViewerId = accountUser?.id,
                initialMessageConversation = pendingMessageConversation,
                onInitialMessageConversationHandled = { pendingMessageConversation = null },
                initialNotificationConversationId = pendingNotificationConversationId,
                onInitialNotificationConversationHandled = { pendingNotificationConversationId = null },
                initialNotificationOrderId = pendingNotificationOrderId,
                onInitialNotificationOrderHandled = { pendingNotificationOrderId = null },
                initialGroupInvitations = pendingGroupInvitations,
                onInitialGroupInvitationsHandled = { pendingGroupInvitations = false },
                initialChannelInvitations = pendingChannelInvitations,
                onInitialChannelInvitationsHandled = { pendingChannelInvitations = false },
                initialGroupInvitationToken = pendingGroupInvitationToken.value, onInitialGroupInvitationTokenHandled = { pendingGroupInvitationToken.value = null }, initialChannelInvitationToken = channelInvitationNavigation.token, onInitialChannelInvitationTokenHandled = channelInvitationNavigation::consume,
                initialSupportTicketId = pendingSupportTicketId,
                onInitialSupportTicketHandled = { pendingSupportTicketId = null },
                initialDisputeId = pendingNotificationDisputeId,
                onInitialDisputeHandled = { pendingNotificationDisputeId = null },
                initialClipId = pendingNotificationClipId,
                onInitialClipHandled = { pendingNotificationClipId = null },
                savedPostsRepository = savedPostsRepository,
                martRepository = martRepository,
                storeRepository = storeRepository,
                showMartCategoryPane = showMartCategoryPane,
                initialMartProductId = pendingMartProductId,
                onInitialMartProductHandled = { pendingMartProductId = null },
                initialMartCategoryId = pendingMartCategoryId,
                initialMartCategoryName = pendingMartCategoryName,
                onBackFromInitialMartCategory = {
                    if (returnToDiscoverAfterCategory) {
                        returnToDiscoverAfterCategory = false
                        destination = Destination.Discover
                    }
                },
                onInitialMartCategoryHandled = {
                    pendingMartCategoryId = null
                    pendingMartCategoryName = null
                },
                onOpenSavedPosts = { if (isGuest) onRequireSignIn() else destination = Destination.Saved },
                onBackFromSavedPosts = { destination = Destination.Feed },
                onBackFromOrders = { destination = Destination.Feed },
                onCheckBuyerOrderPayment = { purchaseState.checkExistingOrderPayment(it) },
                onBackFromFollowRequests = { destination = Destination.Profile },
                onOpenMessages = { if (isGuest) onRequireSignIn() else destination = Destination.Messages },
                onOpenSearch = { destination = Destination.Discover },
                onClipReauthenticate = onSignOut,
                notificationActions = signedInNotificationActions(
                    isGuest = isGuest,
                    onRequireSignIn = onRequireSignIn,
                    onSelectDestination = { destination = it },
                    onSetPendingConversation = { pendingMessageConversation = it },
                    onQueueGroupInvitations = { pendingGroupInvitations = true },
                    onOpenSpaces = { destination = Destination.Spaces },
                    onQueueSupportTicket = { pendingSupportTicketId = it },
                    onQueueDispute = { pendingNotificationDisputeId = it },
                    onQueueClip = { pendingNotificationClipId = it },
                ),
                onBackFromSupportRequests = { destination = Destination.Notifications },
                onOpenBusinessTools = { if (isGuest) onRequireSignIn() else destination = Destination.Business },
                businessContent = businessContent,
            )
                }
            }
        },
    )
}

