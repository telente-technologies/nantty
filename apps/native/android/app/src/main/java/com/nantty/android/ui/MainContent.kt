package com.nantty.android.ui

import android.content.Intent
import android.net.Uri
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
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.AccountNotificationSettingsRepository
import com.nantty.android.data.CountryPreferenceRepository
import com.nantty.android.data.ClipsRepository
import com.nantty.android.data.ClipWatchTrackingRepository
import com.nantty.android.data.ChatNotificationSettingsRepository
import com.nantty.android.data.ChatPasscodeRepository
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.ProductReviewsRepository
import com.nantty.android.data.BuyerOrderDetail
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
import com.nantty.android.data.LiveCoinTipRepository
import com.nantty.android.data.LiveSessionsRepository
import com.nantty.android.data.NotificationsRepository
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.ProfileImageRepository
import com.nantty.android.data.SavedPostsRepository
import com.nantty.android.data.SearchRepository
import com.nantty.android.data.StoreRepository
import com.nantty.android.data.SupportTicketRepository
import com.nantty.android.data.SpacesRepository
import com.nantty.android.data.StoriesRepository
import com.nantty.android.data.StoryAdsRepository
import com.nantty.android.data.StoryAdDestination
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
    onOpenPostComment: (String, String) -> Unit = { postId, _ -> onOpenPost(postId) },
    onOpenProfile: (String) -> Unit = {},
    searchScope: String = SearchRepository.GLOBAL_SCOPE,
    searchScopeLabel: String = "Everywhere",
    onSearchScopeChanged: (String, String) -> Unit = { _, _ -> },
    onOpenProduct: (String) -> Unit = {},
    onOpenStore: (String) -> Unit = {},
    onOpenBrand: (String) -> Unit = {},
    onOpenCategory: (String, String) -> Unit = { _, _ -> },
    onLike: (FeedPost) -> Unit = {},
    onRepost: (FeedPost) -> Unit = {},
    onSave: (FeedPost) -> Unit = {},
    onShare: (FeedPost) -> Unit = {},
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
    countryPreferenceRepository: CountryPreferenceRepository? = null,
    countryPreferenceNavigation: CountryPreferenceNavigation? = null,
    chatNotificationSettingsRepository: ChatNotificationSettingsRepository? = null,
    chatPasscodeRepository: ChatPasscodeRepository? = null,
    onOpenChatPasscodeSettings: () -> Unit = {},
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
    liveSessionsRepository: LiveSessionsRepository? = null,
    liveCoinTipRepository: LiveCoinTipRepository? = null,
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
    onOpenMessages: () -> Unit = {},
    onOpenNotificationConversation: (InboxConversation) -> Unit = {},
    onOpenSearch: () -> Unit = {},
    onClipReauthenticate: () -> Unit = onReauthenticate,
    notificationActions: MainContentNotificationActions = MainContentNotificationActions(),
    onSearchCurrentProfile: (String, String) -> Unit = { _, _ -> },
    onOpenConnections: (String, String) -> Unit = { _, _ -> },
    onOpenBusinessTools: () -> Unit = {},
    businessContent: (@Composable () -> Unit)? = null,
) {
    val context = LocalContext.current
    if (destination == Destination.Live && liveSessionsRepository != null && liveCoinTipRepository != null && ioExecutor != null && initialLiveId != null) {
        com.nantty.android.ui.live.LiveWatchScreen(
            liveId = initialLiveId,
            sessions = liveSessionsRepository,
            coinTips = liveCoinTipRepository,
            executor = ioExecutor,
            onBack = onBackFromLive,
            onReauthenticate = onReauthenticate,
            modifier = modifier,
        )
        return
    }
    if (destination == Destination.Clips && clipsRepository != null && postDetailRepository != null && publicProfileRepository != null && ioExecutor != null) {
        com.nantty.android.ui.clips.ClipsScreen(
            repository = clipsRepository,
            postRepository = postDetailRepository,
            profileRepository = publicProfileRepository,
            executor = ioExecutor,
            watchTrackingRepository = clipWatchTrackingRepository,
            isGuest = !canViewFollowing,
            onSignInRequiredWithAction = onSignInRequiredWithAction,
            onReauthenticate = onClipReauthenticate,
            onOpenSearch = onOpenSearch,
            onOpenPost = onOpenPost,
            onOpenProfile = onOpenProfile,
            initialClipId = initialClipId,
            onInitialClipHandled = onInitialClipHandled,
            modifier = modifier,
        )
        return
    }
    if (destination == Destination.Spaces && spacesRepository != null && ioExecutor != null) {
        com.nantty.android.ui.spaces.SpacesScreen(
            repository = spacesRepository,
            accessToken = spacesAccessToken,
            viewerId = spacesViewerId,
            executor = ioExecutor,
            onSignInRequired = onSignInRequired,
            modifier = modifier,
        )
        return
    }
    if (destination == Destination.CountryPreference && countryPreferenceRepository != null && countryPreferenceNavigation != null && ioExecutor != null) {
        CountryPreferenceScreen(
            repository = countryPreferenceRepository,
            executor = ioExecutor,
            onBack = countryPreferenceNavigation.returnToPrevious,
            onReauthenticate = onReauthenticate,
            onSaved = countryPreferenceNavigation.returnToPrevious,
            modifier = modifier,
        )
        return
    }
    if (destination == Destination.ChatNotificationSettings && chatNotificationSettingsRepository != null && ioExecutor != null) {
        ChatNotificationSettingsScreen(
            repository = chatNotificationSettingsRepository,
            executor = ioExecutor,
            onBack = onBackFromSupportRequests,
            onReauthenticate = onNotificationReauthenticate,
            onOpenBlockedAccounts = onOpenBlockedAccounts,
            onOpenPasscodeSettings = onOpenChatPasscodeSettings,
            onSettingsChanged = onChatNotificationsSaved,
            modifier = modifier,
        )
        return
    }
    if (destination == Destination.ChatPasscode && chatPasscodeRepository != null) {
        ChatPasscodeSettingsScreen(
            repository = chatPasscodeRepository,
            onBack = onOpenChatNotificationSettings,
            onPasscodeUpdated = onChatPasscodeUpdated,
            modifier = modifier,
        )
        return
    }
    if (destination == Destination.Profile && currentProfileRepository != null && ioExecutor != null) {
        CurrentProfileScreen(
            repository = currentProfileRepository,
            executor = ioExecutor,
            modifier = modifier,
            onOpenBusinessTools = onOpenBusinessTools,
            onOpenCountryPreferences = countryPreferenceNavigation?.open ?: {},
            onOpenConnections = onOpenConnections,
            onOpenProfile = onOpenProfile,
            onSearchProfile = onSearchCurrentProfile,
            publicProfileRepository = publicProfileRepository,
            profileImagesRepository = profileImagesRepository,
            onOpenPost = onOpenPost,
            followRequestsRepository = followRequestsRepository,
            supportTicketRepository = supportTicketRepository,
            supportMediaRepository = privateMediaUploadsRepository,
            buyerOrdersRepository = buyerOrdersRepository,
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
            onOpenStoryAdDestination = { adDestination ->
                val id = adDestination.targetId?.takeIf(String::isNotBlank)
                when (adDestination.type) {
                    "product" -> id?.let(onOpenProduct)
                    "store" -> id?.let(onOpenStore)
                    "post" -> id?.let(onOpenPost)
                    "profile" -> id?.let(onOpenProfile)
                    "url" -> adDestination.url?.let { rawUrl ->
                        val safeUrl = runCatching { Uri.parse(rawUrl) }.getOrNull()
                            ?.takeIf { it.scheme.equals("https", ignoreCase = true) && !it.host.isNullOrBlank() }
                        safeUrl?.let { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, it)) } }
                    }
                }
            },
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
            accountSettingsRepository = accountNotificationSettingsRepository,
            onOpenFollowRequests = notificationActions.openFollowRequests,
            onOpenGroupInvitations = notificationActions.openGroupInvitations,
            onOpenSpaces = notificationActions.openSpaces,
            onOpenSupportTicket = notificationActions.openSupportTicket,
            onOpenDispute = notificationActions.openDispute,
            onOpenClip = notificationActions.openClip,
        )
        return
    }
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
    if (destination == Destination.DisputeDetail && disputeRepository != null && ioExecutor != null && initialDisputeId != null) {
        BuyerDisputeDetailScreen(
            disputeId = initialDisputeId,
            repository = disputeRepository,
            executor = ioExecutor,
            onBack = onBackFromOrders,
            onReauthenticate = onReauthenticate,
            modifier = modifier,
        )
        androidx.compose.runtime.LaunchedEffect(initialDisputeId) { onInitialDisputeHandled() }
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
            onOpenStore = onOpenStore,
            onOpenProduct = onOpenProduct,
            onCheckPayment = onCheckBuyerOrderPayment,
            reviewRepository = productReviewsRepository,
            messagesRepository = messagesRepository,
            supportTicketRepository = supportTicketRepository,
            onOpenConversation = onOpenNotificationConversation,
            onMessageFailure = onMessageFailure,
            initialOrderId = initialNotificationOrderId,
            onInitialOrderHandled = onInitialNotificationOrderHandled,
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
            onOpenBrand = onOpenBrand,
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
            onBackFromInitialCategory = onBackFromInitialMartCategory,
            onInitialCategoryHandled = onInitialMartCategoryHandled,
            onOpenStore = onOpenStore,
            onOpenBrand = onOpenBrand,
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
