package com.nantty.android.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.nantty.android.data.AccountNotificationSettingsRepository
import com.nantty.android.data.AccountHealthRepository
import com.nantty.android.data.IdentityVerificationRepository
import com.nantty.android.data.CountryPreferenceRepository
import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.ContentPreferencesRepository
import com.nantty.android.data.MentionPrivacyRepository
import com.nantty.android.data.ClipsRepository
import com.nantty.android.data.ClipWatchTrackingRepository
import com.nantty.android.data.ChatNotificationSettingsRepository
import com.nantty.android.data.ChatPasscodeRepository
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.BuyerReturnsRepository
import com.nantty.android.data.ProductReviewsRepository
import com.nantty.android.data.BuyerOrderDetail
import com.nantty.android.data.CurrentProfileRepository
import com.nantty.android.data.BrandActingProfile
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
import com.nantty.android.data.LiveCoinTipRepository
import com.nantty.android.data.LiveCommentsRepository
import com.nantty.android.data.LiveSessionsRepository
import com.nantty.android.data.LiveStageRepository
import com.nantty.android.data.NotificationsRepository
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.ProfileImageRepository
import com.nantty.android.data.SavedPostsRepository
import com.nantty.android.data.SearchRepository
import com.nantty.android.data.StoreRepository
import com.nantty.android.data.CartRepository
import com.nantty.android.data.SaleAttribution
import com.nantty.android.data.ShippingAddressesRepository
import com.nantty.android.data.ProductAdsRepository
import com.nantty.android.data.SupportTicketRepository
import com.nantty.android.data.SpacesRepository
import com.nantty.android.data.StoriesRepository
import com.nantty.android.data.StoryAdsRepository
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
    onCreateStory: () -> Unit = onCreatePost,
    currentAccountAvatarUrl: String? = null,
    modifier: Modifier = Modifier,
    onOpenPost: (String) -> Unit = {},
    onOpenClip: (String) -> Unit = {},
    onOpenClipComments: (String) -> Unit = onOpenPost,
    onOpenPostComment: (String, String) -> Unit = { postId, _ -> onOpenPost(postId) },
    onOpenProfile: (String) -> Unit = {},
    onOpenLive: (String) -> Unit = {},
    searchScope: String = SearchRepository.GLOBAL_SCOPE,
    searchScopeLabel: String = "Everywhere",
    onSearchScopeChanged: (String, String) -> Unit = { _, _ -> },
    onOpenProduct: (String) -> Unit = {},
    onOpenProductWithAttribution: (String, SaleAttribution?) -> Unit = { productId, _ -> onOpenProduct(productId) },
    initialMartSaleAttribution: SaleAttribution? = null,
    feedProductAdsRepository: ProductAdsRepository? = null,
    cartRepository: CartRepository? = null,
    onOpenCart: () -> Unit = {},
    onOpenStore: (String) -> Unit = {},
    onBackToStoreSearch: (String) -> Unit = {},
    onBackToProfileSearch: (String) -> Unit = {},
    onOpenBrand: (String) -> Unit = {},
    onOpenCategory: (String, String) -> Unit = { _, _ -> },
    onLike: (FeedPost) -> Unit = {},
    onFollowAuthor: ((FeedPost) -> Unit)? = null,
    onRepost: (FeedPost) -> Unit = {},
    onSave: (FeedPost) -> Unit = {},
    onShare: (FeedPost) -> Unit = {},
    currentAccountId: String? = null,
    activeProfile: BrandActingProfile? = null,
    onOpenAnalytics: ((String) -> Unit)? = null,
    feedPostActions: FeedDestinationPostActions = FeedDestinationPostActions(),
    interactionMessage: String? = null,
    onMessageFailure: (String, Boolean) -> Unit = { _, _ -> },
    savingPostId: String? = null,
    loadingMore: Boolean = false,
    loadMoreError: String? = null,
    onLoadMore: () -> Unit = {},
    walletRepository: WalletRepository? = null,
    buyerOrdersRepository: BuyerOrdersRepository? = null,
    productReviewsRepository: ProductReviewsRepository? = null,
    disputeRepository: DisputeRepository? = null,
    privateMediaUploadsRepository: CreatorSampleMediaRepository? = null,
    currentProfileRepository: CurrentProfileRepository? = null,
    profileImagesRepository: ProfileImageRepository? = null,
    followRequestsRepository: FollowRequestsRepository? = null,
    ioExecutor: Executor? = null,
    notificationsRepository: NotificationsRepository? = null,
    accountNotificationSettingsRepository: AccountNotificationSettingsRepository? = null,
    accountHealthRepository: AccountHealthRepository? = null,
    identityVerificationRepository: IdentityVerificationRepository? = null,
    countryPreferenceRepository: CountryPreferenceRepository? = null,
    countryPreferenceNavigation: CountryPreferenceNavigation? = null,
    shippingAddressesRepository: ShippingAddressesRepository? = null,
    checkoutRepository: CheckoutRepository? = null,
    onOpenShippingAddresses: () -> Unit = {},
    onBackFromShippingAddresses: () -> Unit = {},
    contentPreferencesRepository: ContentPreferencesRepository? = null,
    mentionPrivacyRepository: MentionPrivacyRepository? = null,
    onBackFromMentionPrivacy: () -> Unit = {},
    onMentionPrivacyReauthenticate: () -> Unit = onReauthenticate,
    onOpenMentionPrivacy: () -> Unit = {},
    onBackFromContentPreferences: () -> Unit = {},
    chatNotificationSettingsRepository: ChatNotificationSettingsRepository? = null,
    chatPasscodeRepository: ChatPasscodeRepository? = null,
    onOpenChatPasscodeSettings: () -> Unit = {},
    onOpenContentPreferences: () -> Unit = {},
    onContentPreferencesChanged: () -> Unit = {},
    onOpenChatNotificationSettings: () -> Unit = {},
    onChatPasscodeUpdated: () -> Unit = {},
    onOpenBlockedAccounts: () -> Unit = {},
    messagesRefreshGeneration: Int = 0,
    onChatNotificationsSaved: () -> Unit = {},
    onNotificationReauthenticate: () -> Unit = {},
    searchRepository: SearchRepository? = null,
    exploreRepository: ExploreRepository? = null,
    publicProfileRepository: PublicProfileRepository? = null,
    messagesRepository: MessagesRepository? = null,
    initialMessageConversation: InboxConversation? = null,
    onInitialMessageConversationHandled: () -> Unit = {},
    initialNotificationConversationId: String? = null,
    onInitialNotificationConversationHandled: () -> Unit = {},
    initialNotificationOrderId: String? = null,
    onInitialNotificationOrderHandled: () -> Unit = {},
    initialGroupInvitations: Boolean = false,
    onInitialGroupInvitationsHandled: () -> Unit = {},
    initialChannelInvitations: Boolean = false,
    onInitialChannelInvitationsHandled: () -> Unit = {},
    initialGroupInvitationToken: String? = null,
    onInitialGroupInvitationTokenHandled: () -> Unit = {},
    initialChannelInvitationToken: String? = null,
    onInitialChannelInvitationTokenHandled: () -> Unit = {},
    initialSupportTicketId: String? = null,
    onInitialSupportTicketHandled: () -> Unit = {},
    initialDisputeId: String? = null,
    onInitialDisputeHandled: () -> Unit = {},
    initialClipId: String? = null,
    onInitialClipHandled: () -> Unit = {},
    savedPostsRepository: SavedPostsRepository? = null,
    martRepository: MartRepository? = null,
    storeRepository: StoreRepository? = null,
    supportTicketRepository: SupportTicketRepository? = null,
    spacesRepository: SpacesRepository? = null,
    initialSpaceId: String? = null,
    onInitialSpaceHandled: () -> Unit = {},
    liveSessionsRepository: LiveSessionsRepository? = null,
    liveStageRepository: LiveStageRepository? = null,
    liveCoinTipRepository: LiveCoinTipRepository? = null,
    liveCommentsRepository: LiveCommentsRepository? = null,
    liveReportRepository: com.nantty.android.data.ProductReportRepository? = null,
    initialLiveId: String? = null,
    onBackFromLive: () -> Unit = {},
    clipsRepository: ClipsRepository? = null,
    clipWatchTrackingRepository: ClipWatchTrackingRepository = ClipWatchTrackingRepository(sessionProvider = { null }),
    storiesRepository: StoriesRepository? = null,
    storyAdsRepository: StoryAdsRepository? = null,
    postDetailRepository: PostDetailRepository? = null,
    spacesAccessToken: String? = null,
    spacesViewerId: String? = null,
    showMartCategoryPane: Boolean = false,
    initialMartProductId: String? = null,
    initialMartAffiliateLinkId: String? = null,
    onInitialMartProductHandled: () -> Unit = {},
    initialMartCategoryId: String? = null,
    initialMartCategoryName: String? = null,
    onBackFromInitialMartCategory: () -> Unit = {},
    onInitialMartCategoryHandled: () -> Unit = {},
    onOpenSavedPosts: () -> Unit = {},
    onBackFromSavedPosts: () -> Unit = {},
    onBackFromOrders: () -> Unit = {},
    onCheckBuyerOrderPayment: (BuyerOrderDetail) -> Unit = {},
    onBackFromFollowRequests: () -> Unit = {},
    onBackFromSupportRequests: () -> Unit = {},
    onBackFromAccountStatus: () -> Unit = onBackFromSupportRequests,
    onOpenMessages: () -> Unit = {},
    onOpenNotificationConversation: (InboxConversation) -> Unit = {},
    onOpenSearch: () -> Unit = {},
    onClipReauthenticate: () -> Unit = onReauthenticate,
    notificationActions: MainContentNotificationActions = MainContentNotificationActions(),
    onSearchCurrentProfile: (String, String) -> Unit = { _, _ -> },
    onOpenConnections: (String, String) -> Unit = { _, _ -> },
    onOpenBusinessTools: () -> Unit = {},
    businessContent: (@Composable () -> Unit)? = null,
    buyerReturnsRepository: BuyerReturnsRepository? = null,
) {
    val context = LocalContext.current
    if (MainRealtimeDestination(
            destination = destination,
            liveSessionsRepository = liveSessionsRepository,
            liveCoinTipRepository = liveCoinTipRepository,
            liveCommentsRepository = liveCommentsRepository,
            liveStageRepository = liveStageRepository,
            liveReportRepository = liveReportRepository,
            initialLiveId = initialLiveId,
            clipsRepository = clipsRepository,
            postDetailRepository = postDetailRepository,
            publicProfileRepository = publicProfileRepository,
            ioExecutor = ioExecutor,
            clipWatchTrackingRepository = clipWatchTrackingRepository,
            canViewFollowing = canViewFollowing,
            onSignInRequired = onSignInRequired,
            onSignInRequiredWithAction = onSignInRequiredWithAction,
            onReauthenticate = onReauthenticate,
            onClipReauthenticate = onClipReauthenticate,
            onOpenSearch = onOpenSearch,
            onOpenPost = onOpenPost,
            onOpenClipComments = onOpenClipComments,
            onOpenProfile = onOpenProfile,
            initialClipId = initialClipId,
            onInitialClipHandled = onInitialClipHandled,
            spacesRepository = spacesRepository,
            spacesAccessToken = spacesAccessToken,
            spacesViewerId = spacesViewerId,
            initialSpaceId = initialSpaceId,
            onInitialSpaceHandled = onInitialSpaceHandled,
            onBackFromLive = onBackFromLive,
            modifier = modifier,
        )) return
    if (AccountSettingsDestination(
            destination = destination,
            countryPreferenceRepository = countryPreferenceRepository,
            countryPreferenceNavigation = countryPreferenceNavigation,
            contentPreferencesRepository = contentPreferencesRepository,
            mentionPrivacyRepository = mentionPrivacyRepository,
            chatNotificationSettingsRepository = chatNotificationSettingsRepository,
            chatPasscodeRepository = chatPasscodeRepository,
            shippingAddressesRepository = shippingAddressesRepository,
            checkoutRepository = checkoutRepository,
            executor = ioExecutor,
            onReauthenticate = onReauthenticate,
            onNotificationReauthenticate = onNotificationReauthenticate,
            onBackFromContentPreferences = onBackFromContentPreferences,
            onContentPreferencesChanged = onContentPreferencesChanged,
            onBackFromMentionPrivacy = onBackFromMentionPrivacy,
            onMentionPrivacyReauthenticate = onMentionPrivacyReauthenticate,
            onBackFromChatSettings = onBackFromSupportRequests,
            onOpenBlockedAccounts = onOpenBlockedAccounts,
            onOpenPasscodeSettings = onOpenChatPasscodeSettings,
            onChatNotificationsSaved = onChatNotificationsSaved,
            onBackFromChatPasscode = onOpenChatNotificationSettings,
            onBackFromShippingAddresses = onBackFromShippingAddresses,
            onChatPasscodeUpdated = onChatPasscodeUpdated,
            modifier = modifier,
        )) return
    if (ProfileDestination(
            destination = destination,
            profileRepository = currentProfileRepository,
            followRequestsRepository = followRequestsRepository,
            executor = ioExecutor,
            modifier = modifier,
            onOpenBusinessTools = onOpenBusinessTools,
            onOpenCountryPreferences = countryPreferenceNavigation?.open ?: {},
            onOpenContentPreferences = onOpenContentPreferences,
            onOpenMentionPrivacy = onOpenMentionPrivacy,
            onOpenShippingAddresses = onOpenShippingAddresses,
            onOpenConnections = onOpenConnections,
            onOpenProfile = onOpenProfile,
            onSearchProfile = onSearchCurrentProfile,
            publicProfileRepository = publicProfileRepository,
            profileImagesRepository = profileImagesRepository,
            onOpenPost = onOpenPost,
            supportTicketRepository = supportTicketRepository,
            supportMediaRepository = privateMediaUploadsRepository,
            buyerOrdersRepository = buyerOrdersRepository,
            onBackFromFollowRequests = onBackFromFollowRequests,
            onReauthenticate = onReauthenticate,
        )) return
    if (destination == Destination.Business && businessContent != null) {
        businessContent()
        return
    }
    if (destination == Destination.Saved && savedPostsRepository != null && ioExecutor != null) {
        SavedPostsScreen(
            repository = savedPostsRepository,
            executor = ioExecutor,
            onBack = onBackFromSavedPosts,
            onOpenPost = onOpenPost,
            onOpenProduct = onOpenProduct,
            onAuthenticationRequired = onReauthenticate,
            modifier = modifier,
        )
        return
    }
    if (destination == Destination.Messages && messagesRepository != null && ioExecutor != null) {
        MessagesDestination(
            repository = messagesRepository, executor = ioExecutor, modifier = modifier,
            onReauthenticate = onReauthenticate, initialConversation = initialMessageConversation,
            onInitialConversationHandled = onInitialMessageConversationHandled,
            initialNotificationConversationId = initialNotificationConversationId,
            onInitialNotificationConversationHandled = onInitialNotificationConversationHandled,
            initialGroupInvitations = initialGroupInvitations,
            onInitialGroupInvitationsHandled = onInitialGroupInvitationsHandled,
            initialChannelInvitations = initialChannelInvitations,
            onInitialChannelInvitationsHandled = onInitialChannelInvitationsHandled,
            initialGroupInvitationToken = initialGroupInvitationToken,
            onInitialGroupInvitationTokenHandled = onInitialGroupInvitationTokenHandled,
            initialChannelInvitationToken = initialChannelInvitationToken,
            onInitialChannelInvitationTokenHandled = onInitialChannelInvitationTokenHandled,
            onOpenChatNotificationSettings = onOpenChatNotificationSettings,
            externalRefreshGeneration = messagesRefreshGeneration, storiesRepository = storiesRepository,
            storyAdsRepository = storyAdsRepository,
            liveSessionsRepository = liveSessionsRepository,
            onOpenLive = onOpenLive,
            onOpenStoryAdDestination = { adDestination ->
                dispatchStoryAdDestination(
                    destination = adDestination,
                    onProduct = onOpenProduct,
                    onStore = onOpenStore,
                    onPost = onOpenPost,
                    onProfile = onOpenProfile,
                    onMessages = onOpenMessages,
                    onExternal = { uri -> runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uri.toString()))) } },
                )
            },
            currentUserAvatarUrl = currentAccountAvatarUrl,
            onAddStory = onCreateStory,
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
            onOpenPostComment = onOpenPostComment,
            onOpenProfile = onOpenProfile,
            onOpenMessages = onOpenMessages,
            onOpenConversation = notificationActions.openConversation,
            messagesRepository = messagesRepository,
            onOpenOrders = notificationActions.openOrders,
            onOpenOrder = notificationActions.openOrder,
            accountSettingsRepository = accountNotificationSettingsRepository,
            onOpenFollowRequests = notificationActions.openFollowRequests,
            onOpenGroupInvitations = notificationActions.openGroupInvitations,
            onOpenSpaces = notificationActions.openSpaces,
            onOpenAccountStatus = { notificationActions.openAccountPolicy(Destination.AccountStatus) },
            onOpenIdentityVerification = { notificationActions.openAccountPolicy(Destination.IdentityVerification) },
            onOpenSupportTicket = notificationActions.openSupportTicket,
            onOpenDispute = notificationActions.openDispute,
            onOpenClip = notificationActions.openClip,
        )
        return
    }
    if (AccountPolicyDestination(
            destination, accountHealthRepository, identityVerificationRepository, ioExecutor, modifier,
            onBackFromAccountStatus, onNotificationReauthenticate,
        )
    ) return
    if (destination == Destination.SupportRequests && supportTicketRepository != null && ioExecutor != null) {
        SupportRequestsScreen(
            repository = supportTicketRepository,
            executor = ioExecutor,
            onBack = onOpenMessages,
            onAuthenticationRequired = onReauthenticate,
            initialTicketId = initialSupportTicketId,
            onInitialTicketHandled = onInitialSupportTicketHandled,
            modifier = modifier,
        )
        return
    }
    if (MainCommerceDestination(
            destination = destination,
            walletRepository = walletRepository,
            buyerOrdersRepository = buyerOrdersRepository,
            buyerReturnsRepository = buyerReturnsRepository,
            productReviewsRepository = productReviewsRepository,
            disputeRepository = disputeRepository,
            privateMediaUploadsRepository = privateMediaUploadsRepository,
            messagesRepository = messagesRepository,
            supportTicketRepository = supportTicketRepository,
            executor = ioExecutor,
            onReauthenticate = onReauthenticate,
            onBackFromOrders = onBackFromOrders,
            onCheckBuyerOrderPayment = onCheckBuyerOrderPayment,
            onOpenStore = onOpenStore,
            onOpenProduct = onOpenProduct,
            onOpenConversation = onOpenNotificationConversation,
            onMessageFailure = onMessageFailure,
            initialOrderId = initialNotificationOrderId,
            onInitialOrderHandled = onInitialNotificationOrderHandled,
            initialDisputeId = initialDisputeId,
            onInitialDisputeHandled = onInitialDisputeHandled,
            modifier = modifier,
        )) return
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
            onBackToStore = onBackToStoreSearch,
            onBackToProfile = onBackToProfileSearch,
            onOpenBrand = onOpenBrand,
            onOpenCategory = onOpenCategory,
            exploreRepository = exploreRepository,
            profileRepository = publicProfileRepository,
            onRequireSignIn = onSignInRequired,
            onRequireSignInWithAction = onSignInRequiredWithAction,
            initialScope = searchScope,
            initialScopeLabel = searchScopeLabel,
            onScopeChanged = onSearchScopeChanged,
            productAdsRepository = feedProductAdsRepository,
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
            initialAffiliateLinkId = initialMartAffiliateLinkId,
            onInitialProductHandled = onInitialMartProductHandled,
            initialSaleAttribution = initialMartSaleAttribution,
            initialCategoryId = initialMartCategoryId,
            initialCategoryName = initialMartCategoryName,
            onBackFromInitialCategory = onBackFromInitialMartCategory,
            onInitialCategoryHandled = onInitialMartCategoryHandled,
            onOpenStore = onOpenStore,
            onOpenBrand = onOpenBrand,
            storeRepository = storeRepository,
            productAdsRepositoryOverride = feedProductAdsRepository,
            onOpenCart = onOpenCart,
        )
        return
    }
    FeedDestinationContent(
        destination = destination,
        result = result,
        loading = loading,
        selectedFeed = selectedFeed,
        canViewFollowing = canViewFollowing,
        onSelectFeed = onSelectFeed,
        onSignInRequired = onSignInRequired,
        onFollowingSignInRequired = onFollowingSignInRequired,
        onRefresh = onRefresh,
        onCreatePost = onCreatePost,
        modifier = modifier,
        onOpenPost = onOpenPost,
        onOpenProfile = onOpenProfile,
        onLike = onLike,
        onFollowAuthor = onFollowAuthor,
        onRepost = onRepost,
        onSave = onSave,
        onShare = onShare,
        interactionMessage = interactionMessage,
        onReauthenticate = onReauthenticate,
        savingPostId = savingPostId,
        loadingMore = loadingMore,
        loadMoreError = loadMoreError,
        onLoadMore = onLoadMore,
        onOpenSavedPosts = onOpenSavedPosts,
        currentAccountId = currentAccountId,
        activeProfileId = activeProfile?.id,
        activeProfile = activeProfile,
        onOpenAnalytics = onOpenAnalytics,
        postActions = feedPostActions,
        onOpenProduct = onOpenProduct,
        onOpenProductWithAttribution = onOpenProductWithAttribution,
        productAdsRepository = feedProductAdsRepository,
        martRepository = martRepository,
        cartRepository = cartRepository,
        ioExecutor = ioExecutor,
        onSignInRequiredWithAction = onSignInRequiredWithAction,
        onOpenCart = onOpenCart,
        onOpenSearch = onOpenSearch,
        exploreRepository = exploreRepository,
        publicProfileRepository = publicProfileRepository,
        clipsRepository = clipsRepository,
        onOpenClip = onOpenClip,
    )
}
