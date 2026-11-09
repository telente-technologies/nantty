package com.nantty.android.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.nantty.android.data.AccountUser
import com.nantty.android.AffiliateProductDeepLink
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.FeedRepository
import com.nantty.android.data.FollowRequestsRepository
import com.nantty.android.data.FeedType
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.restoreSaleAttribution
import com.nantty.android.data.PostDetailRepository
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
    requestedAffiliateProductLink: AffiliateProductDeepLink? = null,
    onAffiliateProductLinkHandled: () -> Unit = {},
) {
    val shareContext = LocalContext.current.applicationContext
    val destinationState = rememberSaveable { mutableStateOf(Destination.Feed) }
    var destination by destinationState
    val countryPreferenceNavigation = rememberCountryPreferenceNavigation(destination) { destination = it }
    val selectedFeedState = rememberSaveable { mutableStateOf(FeedType.FOR_YOU) }
    var selectedFeed by selectedFeedState
    val selectedTopicState = rememberSaveable { mutableStateOf<String?>(null) }
    var selectedTopicId by selectedTopicState
    val feedSelectionGenerationState = rememberSaveable { mutableStateOf(0) }
    val selectedPostIdState = rememberSaveable { mutableStateOf<String?>(null) }
    var selectedPostId by selectedPostIdState
    val selectedPostCommentIdState = rememberSaveable { mutableStateOf<String?>(null) }
    var selectedPostCommentId by selectedPostCommentIdState
    val selectedPostAnalyticsIdState = rememberSaveable { mutableStateOf<String?>(null) }
    var selectedPostAnalyticsId by selectedPostAnalyticsIdState
    val selectedProfileIdState = rememberSaveable { mutableStateOf<String?>(null) }
    var selectedProfileId by selectedProfileIdState
    val selectedConnectionsUserIdState = rememberSaveable { mutableStateOf<String?>(null) }
    var selectedConnectionsUserId by selectedConnectionsUserIdState
    var selectedConnectionsTab by rememberSaveable { mutableStateOf("followers") }
    val showingConnectionsState = rememberSaveable { mutableStateOf(false) }
    var showingConnections by showingConnectionsState
    fun openConnections(userId: String, tab: String) {
        selectedConnectionsUserId = userId
        selectedConnectionsTab = tab
        showingConnections = true
    }
    val pendingMessageConversationState = remember { mutableStateOf<InboxConversation?>(null) }
    var pendingMessageConversation by pendingMessageConversationState
    var pendingNotificationConversationId by rememberSaveable { mutableStateOf<String?>(null) }; var pendingNotificationOrderId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingGroupInvitations by rememberSaveable { mutableStateOf(false) }; var pendingChannelInvitations by rememberSaveable { mutableStateOf(false) }
    val pendingGroupInvitationToken = rememberGroupInvitationLinkRoute(requestedGroupInvitationToken, onGroupInvitationTokenHandled) { destination = Destination.Messages }
    val channelInvitationNavigation = rememberChannelInvitationNavigation(requestedChannelInvitationToken, onChannelInvitationTokenHandled) { destination = Destination.Messages }
    var pendingSupportTicketId by rememberSaveable { mutableStateOf<String?>(null) }; var pendingNotificationClipId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingNotificationDisputeId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingLiveId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingSharedSpaceId by rememberSaveable { mutableStateOf<String?>(null) }
    val messagesRefreshGenerationState = rememberSaveable { mutableStateOf(0) }
    var messagesRefreshGeneration by messagesRefreshGenerationState
    val profileOpenedFromConnectionsState = rememberSaveable { mutableStateOf(false) }
    var profileOpenedFromConnections by profileOpenedFromConnectionsState
    val selectedStoreIdState = rememberSaveable { mutableStateOf<String?>(null) }
    var selectedStoreId by selectedStoreIdState
    val selectedBrandIdState = rememberSaveable { mutableStateOf<String?>(null) }
    var selectedBrandId by selectedBrandIdState
    val searchScopeState = rememberSaveable { mutableStateOf("global") }
    var searchScope by searchScopeState
    val searchScopeLabelState = rememberSaveable { mutableStateOf("Everywhere") }
    var searchScopeLabel by searchScopeLabelState
    val purchaseState = rememberSaveable(saver = SignedInPurchaseState.Saver) { SignedInPurchaseState() }
    val pendingMartProductIdState = rememberSaveable { mutableStateOf<String?>(null) }
    var pendingMartProductId by pendingMartProductIdState
    var pendingMartAttributionSource by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingMartAttributionId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingMartAttributionExpiry by rememberSaveable { mutableStateOf<Long?>(null) }
    var pendingMartAffiliateLinkId by rememberSaveable { mutableStateOf<String?>(null) }
    val pendingMartSaleAttribution = restoreSaleAttribution(
        pendingMartAttributionSource,
        pendingMartAttributionId,
        pendingMartAttributionExpiry,
    )
    var pendingMartCategoryId by rememberSaveable { mutableStateOf<String?>(null) }
    var pendingMartCategoryName by rememberSaveable { mutableStateOf<String?>(null) }
    var returnToDiscoverAfterCategory by rememberSaveable { mutableStateOf(false) }
    val destinationStateHolder = rememberSaveableStateHolder()
    val composerModeState = rememberSaveable { mutableStateOf(SignedInComposerMode.CLOSED) }
    var composerMode by composerModeState
    val quoteTarget = remember { mutableStateOf<com.nantty.android.data.FeedQuotedPost?>(null) }
    LaunchedEffect(requestedAffiliateProductLink) {
        val link = requestedAffiliateProductLink ?: return@LaunchedEffect
        pendingMartProductId = link.productId
        pendingMartAttributionSource = null
        pendingMartAttributionId = null
        pendingMartAttributionExpiry = null
        pendingMartAffiliateLinkId = link.affiliateLinkId
        destination = Destination.Mart
        onAffiliateProductLinkHandled()
    }
    SignedInWidgetDestinationEffect(
        requestedDestination = requestedWidgetDestination,
        isGuest = isGuest,
        onRequireSignIn = onRequireSignIn,
        onSelectDestination = { destination = it },
        onShowComposer = { composerMode = if (it) SignedInComposerMode.POST else SignedInComposerMode.CLOSED },
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
    var savingPostId by remember { mutableStateOf<String?>(null) }
    val executor = remember { Executors.newSingleThreadExecutor() }
    val feedRuntime = rememberSignedInFeedRuntime(
        repository = repository,
        sessionRepository = sessionRepository,
        executor = executor,
        selection = SignedInFeedSelectionState(selectedFeedState, selectedTopicState, feedSelectionGenerationState),
    )
    val feedController = feedRuntime.controller
    val feedTopics = feedRuntime.topics
    val result by feedRuntime.content.result
    val loading by feedRuntime.content.loading
    val loadingMore by feedRuntime.content.loadingMore
    val loadMoreError by feedRuntime.content.loadMoreError
    val interactionMessage = feedController.interactionMessage
    val repositories = rememberSignedInRepositories(sessionRepository)
    val reportFlows = rememberSignedInReportFlows(sessionRepository, isGuest, onRequireSignIn, onSignOut)
    val (
        walletRepository,
        _,
        _,
        _,
        buyerOrdersRepository,
        buyerReturnsRepository,
        productReviewsRepository,
        disputeRepository,
        notificationsRepository,
        accountNotificationSettingsRepository,
        countryPreferenceRepository,
        mentionPrivacyRepository,
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
        creatorAffiliatesRepository,
        brandProfilesRepository,
        adsWorkspaceRepository,
        profileImagesRepository,
        privateMediaUploadsRepository,
    ) = repositories
    val activeProfile = rememberSignedInActiveProfile(accountUser?.id, isGuest, brandProfilesRepository, executor)
    val activeProfileId = activeProfile?.id
    val auxiliaryRepositories = rememberSignedInAuxiliaryRepositories(sessionRepository, executor, activeProfileId)
    val businessContent = buildSignedInBusinessContent(
        repositories = repositories,
        executor = executor,
        onReauthenticate = onSignOut,
        onConversationStarted = { pendingMessageConversation = it; destination = Destination.Messages },
        onMessageFailure = { message, authenticationRequired -> if (authenticationRequired) onSignOut() else feedController.showInteractionMessage(message) },
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
            onOpenProduct = {
                pendingMartProductId = it
                pendingMartAffiliateLinkId = null
                pendingMartAttributionSource = null
                pendingMartAttributionId = null
                pendingMartAttributionExpiry = null
                destination = Destination.Mart
            },
        )
        return
    }
    fun refresh() = feedController.refresh()
    fun selectFeed(feed: FeedType) = feedController.selectFeed(feed)
    fun selectTopic(topicId: String?) = feedController.selectTopic(topicId)
    fun loadMore() = feedController.loadMore()

    val feedActions = createSignedInFeedActionsForScreen(
        executor, { PostDetailRepository(sessionProvider = sessionRepository::sessionOrNull) }, publicProfileRepository,
        sessionRepository, repository, feedController, feedController::showInteractionMessage, { savingPostId = it },
        { savingPostId == it }, ::refresh,
    )

    LaunchedEffect(Unit) { refresh() }
    SignedInFeedStartupEffects(
        accountUser?.id, isGuest, initialFollowingAfterSignIn, sessionRepository.sessionOrNull()?.accessToken,
        ::selectFeed, onInitialFollowingHandled, feedTopics.controller::load,
    )

    if (SignedInOverlayDestinations(
            selection = SignedInOverlaySelection(
                composerMode = composerMode,
                quotedPostForComposer = quoteTarget.value,
                selectedPostId = selectedPostId,
                selectedPostAnalyticsId = selectedPostAnalyticsId,
                selectedPostCommentId = selectedPostCommentId,
                canReportSelectedPostComments = selectedPostId != null && reportFlows.clipComments.reportablePostId == selectedPostId,
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
                brandRepository = auxiliaryRepositories.publicBrand,
                messagesRepository = messagesRepository,
                storiesRepository = auxiliaryRepositories.stories,
                storyAdsRepository = repositories.storyAds,
                soundsRepository = auxiliaryRepositories.sounds,
                storyMediaRepository = privateMediaUploadsRepository,
                postAnalyticsRepository = auxiliaryRepositories.postAnalytics,
                executor = executor,
            ),
            actions = createSignedInOverlayActions(
                navigation = SignedInOverlayNavigationState(
                    destination = destinationState,
                    composerMode = composerModeState,
                    quoteTarget = quoteTarget,
                    selectedPostId = selectedPostIdState,
                    selectedPostCommentId = selectedPostCommentIdState,
                    selectedPostAnalyticsId = selectedPostAnalyticsIdState,
                    selectedStoreId = selectedStoreIdState,
                    selectedBrandId = selectedBrandIdState,
                    selectedProfileId = selectedProfileIdState,
                    showingConnections = showingConnectionsState,
                    selectedConnectionsUserId = selectedConnectionsUserIdState,
                    profileOpenedFromConnections = profileOpenedFromConnectionsState,
                    searchScope = searchScopeState,
                    searchScopeLabel = searchScopeLabelState,
                    pendingMartProductId = pendingMartProductIdState,
                    pendingMessageConversation = pendingMessageConversationState,
                    messagesRefreshGeneration = messagesRefreshGenerationState,
                ),
                environment = SignedInOverlayActionEnvironment(
                    refresh = ::refresh,
                    leaveClipPost = reportFlows.clipComments.leaveClipPost,
                    reportClipComment = reportFlows.clipComments.reportComment,
                    openConnections = ::openConnections,
                    requireSignIn = onRequireSignIn,
                    requireSignInWithAction = onRequireSignInWithAction,
                    openExternalStoryDestination = { uri -> runCatching {
                        shareContext.startActivity(
                            Intent(Intent.ACTION_VIEW, Uri.parse(uri.toString())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                        )
                    } },
                ),
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
                ChatLockBoundary(accountUser?.id, isGuest, destination, auxiliaryRepositories.chatPasscode, executor, onSignOut) { onChatPasscodeUpdated ->
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
                onCreatePost = { if (isGuest) onRequireSignIn() else { quoteTarget.value = null; composerMode = SignedInComposerMode.POST } },
                onCreateStory = { if (isGuest) onRequireSignIn() else composerMode = SignedInComposerMode.STORY },
                currentAccountAvatarUrl = accountUser?.avatarUrl,
                modifier = contentModifier,
                onOpenPost = { if (destination == Destination.Clips) reportFlows.clipComments.openComments(it) else reportFlows.clipComments.leaveClipPost(); selectedPostId = it },
                onOpenClip = { pendingNotificationClipId = it; destination = Destination.Clips },
                onOpenPostComment = { postId, commentId ->
                    selectedPostId = postId
                    selectedPostCommentId = commentId
                },
                onOpenAnalytics = { postId -> selectedPostId = null; selectedPostCommentId = null; selectedPostAnalyticsId = postId },
                onOpenProfile = { selectedProfileId = it; profileOpenedFromConnections = false },
                onOpenLive = { pendingLiveId = it; destination = Destination.Live },
                onOpenConnections = ::openConnections,
                onSearchCurrentProfile = { accountId, username ->
                    searchScope = "profile:$accountId"
                    searchScopeLabel = "@${username.removePrefix("@")}"
                    destination = Destination.Discover
                },
                onBackToStoreSearch = { storeId -> selectedStoreId = storeId },
                onBackToProfileSearch = { profileId -> if (profileId == accountUser?.id) { selectedProfileId = null; destination = Destination.Profile } else selectedProfileId = profileId },
                searchScope = searchScope,
                searchScopeLabel = searchScopeLabel,
                onSearchScopeChanged = { scope, label ->
                    searchScope = scope
                    searchScopeLabel = label
                },
                onOpenProduct = {
                    pendingMartProductId = it
                    pendingMartAffiliateLinkId = null
                    pendingMartAttributionSource = null
                    pendingMartAttributionId = null
                    pendingMartAttributionExpiry = null
                    destination = Destination.Mart
                },
                onOpenProductWithAttribution = { productId, attribution ->
                    pendingMartProductId = productId
                    pendingMartAffiliateLinkId = null
                    pendingMartAttributionSource = attribution?.source?.apiValue
                    pendingMartAttributionId = attribution?.id
                    pendingMartAttributionExpiry = attribution?.expiresAtMillis
                    destination = Destination.Mart
                },
                initialMartSaleAttribution = pendingMartSaleAttribution,
                cartRepository = repositories.cart,
                onOpenCart = { if (isGuest) onRequireSignIn() else purchaseState.openCart() },
                onOpenStore = { selectedStoreId = it },
                onOpenBrand = { brandId -> selectedStoreId = null; selectedBrandId = brandId },
                onOpenCategory = { categoryId, name ->
                    pendingMartCategoryId = categoryId
                    pendingMartCategoryName = name
                    returnToDiscoverAfterCategory = destination == Destination.Discover
                    destination = Destination.Mart
                },
                onLike = { if (isGuest) onRequireSignIn() else feedActions.like(it) },
                onFollowAuthor = { if (isGuest) onRequireSignIn() else feedActions.followAuthor(it) },
                onRepost = { if (isGuest) onRequireSignIn() else feedActions.repost(it) },
                onSave = { if (isGuest) onRequireSignIn() else feedActions.save(it) },
                onShare = { feedActions.share(shareContext, it) },
                currentAccountId = accountUser?.id,
                activeProfile = activeProfile,
                feedPostActions = signedInFeedPostActions(reportFlows.post, isGuest, onRequireSignIn, feedActions) { quote ->
                    quoteTarget.value = quote
                    composerMode = SignedInComposerMode.POST
                }.copy(
                    resolveSharedContent = feedActions::resolveSharedContent,
                    openSharedContent = { card ->
                        when (card.reference.kind) {
                            "post" -> { selectedPostId = card.reference.id; selectedPostCommentId = null }
                            "clip" -> { pendingNotificationClipId = card.reference.id; destination = Destination.Clips }
                            "product" -> { pendingMartProductId = card.reference.id; pendingMartAffiliateLinkId = null; destination = Destination.Mart }
                            "store" -> selectedStoreId = card.reference.id
                            "live" -> { pendingLiveId = card.reference.id; destination = Destination.Live }
                            "order" -> { pendingNotificationOrderId = card.reference.id; destination = Destination.Orders }
                            "profile" -> {
                                selectedProfileId = card.profileUserId ?: card.reference.id
                                profileOpenedFromConnections = false
                            }
                            "space" -> { pendingSharedSpaceId = card.reference.id; destination = Destination.Spaces }
                        }
                    },
                ),
                interactionMessage = interactionMessage,
                onMessageFailure = { message, authenticationRequired ->
                    if (authenticationRequired) onSignOut() else feedController.showInteractionMessage(message)
                },
                savingPostId = savingPostId,
                loadingMore = loadingMore,
                loadMoreError = loadMoreError,
                onLoadMore = ::loadMore,
                walletRepository = walletRepository,
                buyerOrdersRepository = buyerOrdersRepository,
                buyerReturnsRepository = buyerReturnsRepository,
                productReviewsRepository = productReviewsRepository,
                disputeRepository = disputeRepository,
                privateMediaUploadsRepository = privateMediaUploadsRepository,
                currentProfileRepository = currentProfileRepository,
                profileImagesRepository = profileImagesRepository,
                followRequestsRepository = followRequestsRepository,
                ioExecutor = executor,
                notificationsRepository = notificationsRepository,
                accountNotificationSettingsRepository = accountNotificationSettingsRepository,
                accountHealthRepository = repositories.accountHealth, identityVerificationRepository = repositories.identityVerification,
                countryPreferenceRepository = countryPreferenceRepository,
                countryPreferenceNavigation = countryPreferenceNavigation,
                shippingAddressesRepository = repositories.shippingAddresses,
                checkoutRepository = repositories.checkout,
                onOpenShippingAddresses = { destination = Destination.ShippingAddresses },
                onBackFromShippingAddresses = { destination = Destination.Profile },
                chatNotificationSettingsRepository = repositories.chatNotificationSettings,
                chatPasscodeRepository = auxiliaryRepositories.chatPasscode,
                onOpenChatNotificationSettings = { destination = Destination.ChatNotificationSettings },
                onOpenChatPasscodeSettings = { destination = Destination.ChatPasscode },
                onOpenContentPreferences = { destination = Destination.ContentPreferences },
                onOpenMentionPrivacy = { destination = Destination.MentionPrivacy },
                onBackFromContentPreferences = { destination = Destination.Profile },
                contentPreferencesRepository = auxiliaryRepositories.contentPreferences,
                mentionPrivacyRepository = mentionPrivacyRepository,
                onBackFromMentionPrivacy = { destination = Destination.Profile },
                onMentionPrivacyReauthenticate = onSignOut,
                onContentPreferencesChanged = ::refresh,
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
                spacesRepository = auxiliaryRepositories.spaces,
                initialSpaceId = pendingSharedSpaceId,
                onInitialSpaceHandled = { pendingSharedSpaceId = null },
                liveSessionsRepository = auxiliaryRepositories.live.sessions,
                liveStageRepository = auxiliaryRepositories.live.stage,
                liveCoinTipRepository = auxiliaryRepositories.live.coinTips,
                liveCommentsRepository = auxiliaryRepositories.live.comments,
                liveReportRepository = auxiliaryRepositories.live.reports,
                initialLiveId = pendingLiveId,
                onBackFromLive = { pendingLiveId = null; destination = Destination.Feed },
                clipsRepository = repositories.clips,
                clipWatchTrackingRepository = repositories.clipWatchTracking,
                storiesRepository = auxiliaryRepositories.stories,
                storyAdsRepository = repositories.storyAds,
                postDetailRepository = auxiliaryRepositories.postDetails,
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
                feedProductAdsRepository = auxiliaryRepositories.productAds,
                storeRepository = storeRepository,
                showMartCategoryPane = showMartCategoryPane,
                initialMartProductId = pendingMartProductId,
                initialMartAffiliateLinkId = pendingMartAffiliateLinkId,
                onInitialMartProductHandled = {
                    pendingMartProductId = null
                    pendingMartAffiliateLinkId = null
                    pendingMartAttributionSource = null
                    pendingMartAttributionId = null
                    pendingMartAttributionExpiry = null
                },
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
                    isGuest, onRequireSignIn,
                    SignedInNotificationRoutes(
                        selectDestination = { destination = it },
                        setPendingConversation = { pendingMessageConversation = it },
                        queueGroupInvitations = { pendingGroupInvitations = true },
                        openSpaces = { destination = Destination.Spaces },
                        queueSupportTicket = { pendingSupportTicketId = it },
                        queueDispute = { pendingNotificationDisputeId = it },
                        queueClip = { pendingNotificationClipId = it },
                        queueOrder = { pendingNotificationOrderId = it },
                    ),
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

