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
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.FeedPost
import com.nantty.android.data.BrandActingProfile
import com.nantty.android.data.FeedLinkPreview
import com.nantty.android.data.FeedFeedbackKind
import com.nantty.android.data.FeedQuotedPost
import com.nantty.android.data.FeedResult
import com.nantty.android.data.FeedType
import com.nantty.android.data.ExploreRepository
import com.nantty.android.data.ExploreResult
import com.nantty.android.data.ExploreSuggestion
import com.nantty.android.data.FollowActionResult
import com.nantty.android.data.FeedSuggestionDismissalsStore
import com.nantty.android.data.SuggestedClipsPreferencesStore
import com.nantty.android.data.ClipFeedItem
import com.nantty.android.data.ClipsFeedTab
import com.nantty.android.data.ClipsRepository
import com.nantty.android.data.ClipsResult
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.CartRepository
import com.nantty.android.data.MartProductAd
import com.nantty.android.data.MartRepository
import com.nantty.android.data.SaleAttribution
import com.nantty.android.data.MartRecommendationsResult
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
    activeProfile: BrandActingProfile? = null,
    onOpenAnalytics: ((String) -> Unit)? = null,
    postActions: FeedDestinationPostActions = FeedDestinationPostActions(),
    onFollowAuthor: ((FeedPost) -> Unit)? = null,
    onOpenProduct: ((String) -> Unit)? = null,
    onOpenProductWithAttribution: ((String, SaleAttribution?) -> Unit)? = null,
    productAdsRepository: ProductAdsRepository? = null,
    martRepository: MartRepository? = null,
    cartRepository: CartRepository? = null,
    ioExecutor: Executor? = null,
    onSignInRequiredWithAction: ((() -> Unit) -> Unit) = {},
    onOpenCart: () -> Unit = {},
    onOpenSearch: () -> Unit = {},
    exploreRepository: ExploreRepository? = null,
    publicProfileRepository: PublicProfileRepository? = null,
    clipsRepository: ClipsRepository? = null,
    onOpenClip: (String) -> Unit = {},
) {
    val posts = (result as? FeedResult.Success)?.posts.orEmpty()
    val firstPostId = posts.firstOrNull()?.id
    val organicPostCount = posts.count { !it.isSponsored }
    val shouldRequestProductAd = destination == Destination.Feed && selectedFeed == FeedType.FOR_YOU &&
        currentAccountId != null && posts.size >= PRODUCT_AD_MINIMUM_ORGANIC_POSTS && posts.none(FeedPost::isSponsored)
    val recommendationAccountKey = currentAccountId ?: "guest"
    val shouldRequestProductRecommendations = destination == Destination.Feed && selectedFeed == FeedType.FOR_YOU &&
        organicPostCount >= PRODUCT_RECOMMENDATION_FIRST_AFTER_POSTS && martRepository != null
    val productRecommendationInsertBoundaries = remember(posts) {
        organicPostInsertionBoundaries(posts, PRODUCT_RECOMMENDATION_FIRST_AFTER_POSTS, PRODUCT_RECOMMENDATION_REPEAT_EVERY_POSTS).toSet()
    }
    val suggestedClipsAccountKey = currentAccountId ?: "guest"
    val suggestedClipBoundaries = remember(posts) {
        feedRowInsertionBoundaries(posts, SUGGESTED_CLIPS_FIRST_AFTER_ROWS, SUGGESTED_CLIPS_REPEAT_EVERY_ROWS)
    }
    val context = LocalContext.current.applicationContext
    val suggestedClipsStore = remember(context) { SuggestedClipsPreferencesStore(context) }
    var suggestedClipsHiddenUntil by remember(suggestedClipsStore, suggestedClipsAccountKey) { mutableStateOf(0L) }
    var suggestedClipsPreferencesLoaded by remember(suggestedClipsStore, suggestedClipsAccountKey) { mutableStateOf(false) }
    var suggestedClips by remember(clipsRepository, suggestedClipsAccountKey) { mutableStateOf<List<ClipFeedItem>>(emptyList()) }
    var suggestedClipsNextCursor by remember(clipsRepository, suggestedClipsAccountKey) { mutableStateOf<String?>(null) }
    var suggestedClipsLoaded by remember(clipsRepository, suggestedClipsAccountKey) { mutableStateOf(false) }
    var suggestedClipsOptions by remember { mutableStateOf<List<ClipFeedItem>?>(null) }
    var suggestedClipsWhyVisible by remember { mutableStateOf(false) }
    val shouldRequestSuggestedClips = destination == Destination.Feed && selectedFeed == FeedType.FOR_YOU &&
        suggestedClipBoundaries.isNotEmpty() && clipsRepository != null && suggestedClipsPreferencesLoaded &&
        suggestedClipsHiddenUntil <= System.currentTimeMillis()
    val shouldRequestPeopleSuggestions = destination == Destination.Feed && selectedFeed == FeedType.FOR_YOU &&
        currentAccountId != null && exploreRepository != null && publicProfileRepository != null
    val suggestionDismissalsStore = remember(context) { FeedSuggestionDismissalsStore(context) }
    var dismissedSuggestionIds by remember(suggestionDismissalsStore, currentAccountId) { mutableStateOf(emptySet<String>()) }
    var suggestionDismissalsLoaded by remember(suggestionDismissalsStore, currentAccountId) { mutableStateOf(false) }
    var peopleSuggestions by remember(exploreRepository, currentAccountId) { mutableStateOf<List<ExploreSuggestion>>(emptyList()) }
    var suggestionFollowError by remember(currentAccountId) { mutableStateOf<String?>(null) }
    var pendingSuggestionUnfollow by remember(currentAccountId) { mutableStateOf<ExploreSuggestion?>(null) }
    val suggestionFollowStates = remember(currentAccountId) { mutableStateMapOf<String, String>() }
    val suggestionFollowBusyIds = remember(currentAccountId) { mutableStateMapOf<String, Boolean>() }
    val filteredPeopleSuggestions = remember(peopleSuggestions, dismissedSuggestionIds, currentAccountId, suggestionDismissalsLoaded) {
        if (!suggestionDismissalsLoaded) emptyList()
        else peopleSuggestions.filter { it.user.id != currentAccountId && it.user.id !in dismissedSuggestionIds }
    }
    val peopleSuggestionRows = remember(posts, filteredPeopleSuggestions) {
        peopleYouMayKnowInsertions(posts, filteredPeopleSuggestions)
    }
    val adSessionId = rememberSaveable(currentAccountId, selectedFeed, firstPostId) { "feed_ads_${UUID.randomUUID()}" }
    var productAd by remember(adSessionId) { mutableStateOf<MartProductAd?>(null) }
    var feedAdImpressionRecorded by rememberSaveable(adSessionId) { mutableStateOf(false) }
    val adScope = rememberCoroutineScope()
    var recommendedProducts by remember(martRepository, recommendationAccountKey, firstPostId) { mutableStateOf<List<com.nantty.android.data.MartProduct>?>(null) }
    var recommendationSource by remember(martRepository, recommendationAccountKey, firstPostId) { mutableStateOf<String?>(null) }
    var recommendationError by remember(martRepository, recommendationAccountKey, firstPostId) { mutableStateOf<String?>(null) }
    var recommendationRetry by remember(martRepository, recommendationAccountKey, firstPostId) { mutableStateOf(0) }
    val recommendationScope = rememberCoroutineScope()
    val suggestedClipsRows = remember(posts, suggestedClips, suggestedClipsHiddenUntil, suggestedClipsPreferencesLoaded) {
        if (!suggestedClipsPreferencesLoaded || suggestedClipsHiddenUntil > System.currentTimeMillis()) emptyList()
        else suggestedClipsInsertions(posts, suggestedClips)
    }
    LaunchedEffect(suggestedClipsStore, suggestedClipsAccountKey) {
        suggestedClipsPreferencesLoaded = false
        suggestedClipsHiddenUntil = withContext(Dispatchers.IO) { suggestedClipsStore.hiddenUntil(suggestedClipsAccountKey) }
        suggestedClipsPreferencesLoaded = true
    }
    LaunchedEffect(clipsRepository, suggestedClipsAccountKey, suggestedClipBoundaries.size, shouldRequestSuggestedClips) {
        if (!shouldRequestSuggestedClips) return@LaunchedEffect
        val repository = requireNotNull(clipsRepository)
        val targetCount = suggestedClipBoundaries.size * SUGGESTED_CLIPS_PER_ROW
        if (suggestedClipsLoaded && (suggestedClips.size >= targetCount || suggestedClipsNextCursor == null)) return@LaunchedEffect
        var accumulated = suggestedClips
        var cursor = suggestedClipsNextCursor
        var hasLoaded = suggestedClipsLoaded
        while (accumulated.size < targetCount) {
            val response = withContext(Dispatchers.IO) { repository.load(ClipsFeedTab.FOR_YOU, cursor.takeIf { hasLoaded }) }
            when (response) {
                is ClipsResult.Success -> {
                    val known = accumulated.asSequence().map { it.post.id }.toHashSet()
                    accumulated = accumulated + response.page.items.filterNot { it.post.id in known }
                    cursor = response.page.nextCursor
                    hasLoaded = true
                    suggestedClips = accumulated
                    suggestedClipsNextCursor = cursor
                    suggestedClipsLoaded = true
                    if (cursor == null || response.page.items.isEmpty()) break
                }
                is ClipsResult.Failure -> break
            }
        }
    }
    LaunchedEffect(suggestionDismissalsStore, currentAccountId) {
        suggestionDismissalsLoaded = false
        dismissedSuggestionIds = currentAccountId?.let { accountId ->
            withContext(Dispatchers.IO) { suggestionDismissalsStore.read(accountId) }
        }.orEmpty()
        suggestionDismissalsLoaded = true
    }
    LaunchedEffect(exploreRepository, currentAccountId, shouldRequestPeopleSuggestions) {
        peopleSuggestions = emptyList()
        if (!shouldRequestPeopleSuggestions) return@LaunchedEffect
        val suggestionsRepository = requireNotNull(exploreRepository)
        when (val response = withContext(Dispatchers.IO) { suggestionsRepository.loadWhoToFollow(limit = 20, includePrivate = true) }) {
            is ExploreResult.Success -> peopleSuggestions = response.value
            is ExploreResult.Failure -> peopleSuggestions = emptyList()
        }
    }
    LaunchedEffect(productAdsRepository, adSessionId, shouldRequestProductAd) {
        if (!shouldRequestProductAd || productAdsRepository == null) return@LaunchedEffect
        val neighbours = posts.drop(PRODUCT_AD_INSERT_AFTER_POSTS - 1).take(2).map(FeedPost::id)
        val decided = withContext(Dispatchers.IO) {
            productAdsRepository.decideFeedProductAd(adSessionId, PRODUCT_AD_INSERT_AFTER_POSTS, neighbours)
        }
        productAd = (decided as? ProductAdResult.Success)?.ad
    }
    LaunchedEffect(martRepository, recommendationAccountKey, firstPostId, shouldRequestProductRecommendations, recommendationRetry) {
        if (!shouldRequestProductRecommendations || (recommendedProducts != null && recommendationError == null)) return@LaunchedEffect
        val recommendationsRepository = requireNotNull(martRepository)
        recommendationError = null
        when (val result = withContext(Dispatchers.IO) { recommendationsRepository.loadProductRecommendations() }) {
            is MartRecommendationsResult.Success -> {
                recommendedProducts = result.value.products
                recommendationSource = result.value.source
            }
            is MartRecommendationsResult.Failure -> recommendationError = result.message
        }
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
                                onOpenProductWithAttribution = onOpenProductWithAttribution,
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
                            val peopleSuggestionsForRow = peopleSuggestionRows.firstOrNull { it.first == index + 1 }?.second
                            val suggestedClipsForRow = suggestedClipsRows.firstOrNull { it.first == index + 1 }?.second
                            if (suggestedClipsForRow != null) {
                                SuggestedClipsFeedModule(
                                    clips = suggestedClipsForRow,
                                    onOpenClip = onOpenClip,
                                    onMore = { clipIds ->
                                        val clipsById = suggestedClipsForRow.associateBy { it.post.id }
                                        suggestedClipsOptions = clipIds.mapNotNull(clipsById::get)
                                    },
                                )
                            }
                            if (peopleSuggestionsForRow != null && currentAccountId != null) {
                                PeopleYouMayKnowFeedModule(
                                    suggestions = peopleSuggestionsForRow,
                                    followStates = suggestionFollowStates,
                                    busyIds = suggestionFollowBusyIds.filterValues { it }.keys,
                                    onOpenProfile = onOpenProfile,
                                    onFollow = { suggestion ->
                                        val currentState = suggestionFollowStates[suggestion.user.id] ?: "none"
                                        if (currentState == "accepted" || currentState == "requested") {
                                            pendingSuggestionUnfollow = suggestion
                                        } else if (publicProfileRepository != null && suggestionFollowBusyIds[suggestion.user.id] != true) {
                                            suggestionFollowBusyIds[suggestion.user.id] = true
                                            suggestionFollowError = null
                                            adScope.launch {
                                                val action = withContext(Dispatchers.IO) { publicProfileRepository.setFollow(suggestion.user.id, true) }
                                                when (action) {
                                                    is FollowActionResult.Success -> suggestionFollowStates[suggestion.user.id] = action.state
                                                    is FollowActionResult.Failure -> suggestionFollowError = action.message
                                                }
                                                suggestionFollowBusyIds.remove(suggestion.user.id)
                                            }
                                        }
                                    },
                                    onDismiss = { suggestion ->
                                        currentAccountId?.let { accountId ->
                                            adScope.launch {
                                                val saved = withContext(Dispatchers.IO) {
                                                    runCatching { suggestionDismissalsStore.dismiss(accountId, suggestion.user.id) }.getOrDefault(false)
                                                }
                                                if (saved) dismissedSuggestionIds = dismissedSuggestionIds + suggestion.user.id
                                                else suggestionFollowError = "Could not update suggestions. Try again."
                                            }
                                        }
                                    },
                                    onSeeAll = onOpenSearch,
                                )
                                suggestionFollowError?.let { error ->
                                    Text(error, Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 6.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                                }
                            }
                            FeedProductRecommendationInsertion(
                                visible = selectedFeed == FeedType.FOR_YOU && index + 1 in productRecommendationInsertBoundaries &&
                                    onOpenProduct != null && martRepository != null && (recommendedProducts?.isNotEmpty() == true || recommendationError != null),
                                products = recommendedProducts,
                                source = recommendationSource,
                                errorMessage = recommendationError,
                                martRepository = martRepository,
                                recommendationScope = recommendationScope,
                                onOpenProduct = onOpenProduct,
                                onRetry = { recommendationRetry++ },
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
    pendingSuggestionUnfollow?.let { suggestion ->
        val isRequest = suggestionFollowStates[suggestion.user.id] == "requested"
        ConfirmSuggestedPersonUnfollowDialog(
            username = suggestion.user.username,
            isRequest = isRequest,
            onConfirm = {
                pendingSuggestionUnfollow = null
                if (publicProfileRepository != null && suggestionFollowBusyIds[suggestion.user.id] != true) {
                    suggestionFollowBusyIds[suggestion.user.id] = true
                    suggestionFollowError = null
                    adScope.launch {
                        val action = withContext(Dispatchers.IO) { publicProfileRepository.setFollow(suggestion.user.id, false) }
                        when (action) {
                            is FollowActionResult.Success -> suggestionFollowStates[suggestion.user.id] = action.state
                            is FollowActionResult.Failure -> suggestionFollowError = action.message
                        }
                        suggestionFollowBusyIds.remove(suggestion.user.id)
                    }
                }
            },
            onDismiss = { pendingSuggestionUnfollow = null },
        )
    }
    SuggestedClipsOptionsSheet(
        visible = suggestedClipsOptions != null,
        whyVisible = suggestedClipsWhyVisible,
        onDismiss = { suggestedClipsOptions = null },
        onNotInterested = {
            val clips = suggestedClipsOptions.orEmpty()
            suggestedClipsOptions = null
            adScope.launch {
                val now = System.currentTimeMillis()
                val stored = withContext(Dispatchers.IO) { suggestedClipsStore.hideFor(suggestedClipsAccountKey, 7, now) }
                if (stored) suggestedClipsHiddenUntil = now + 7L * 86_400_000L
                if (currentAccountId != null) clips.forEach { clip -> postActions.feedback?.invoke(clip.post, FeedFeedbackKind.LESS) }
            }
        },
        onHideForThirtyDays = {
            suggestedClipsOptions = null
            adScope.launch {
                val now = System.currentTimeMillis()
                val stored = withContext(Dispatchers.IO) { suggestedClipsStore.hideFor(suggestedClipsAccountKey, 30, now) }
                if (stored) suggestedClipsHiddenUntil = now + 30L * 86_400_000L
            }
        },
        onWhy = { suggestedClipsOptions = null; suggestedClipsWhyVisible = true },
        onDismissWhy = { suggestedClipsWhyVisible = false },
    )
}

private const val PRODUCT_AD_MINIMUM_ORGANIC_POSTS = 8
private const val PRODUCT_AD_INSERT_AFTER_POSTS = 8
