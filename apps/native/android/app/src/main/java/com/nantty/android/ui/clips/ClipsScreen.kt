package com.nantty.android.ui.clips

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.ClipFeedItem
import com.nantty.android.data.ClipWatchTrackingRepository
import com.nantty.android.data.ClipsFeedTab
import com.nantty.android.data.ClipsRepository
import com.nantty.android.data.ClipsResult
import com.nantty.android.data.FollowActionResult
import com.nantty.android.data.PostDetailRepository
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.share.sharePostFromAndroid
import java.util.concurrent.Executor

@Composable
internal fun ClipsScreen(
    repository: ClipsRepository,
    postRepository: PostDetailRepository,
    profileRepository: PublicProfileRepository,
    executor: Executor,
    isGuest: Boolean,
    onSignInRequiredWithAction: ((() -> Unit) -> Unit),
    onReauthenticate: () -> Unit,
    onOpenSearch: () -> Unit,
    onOpenPost: (String) -> Unit,
    onOpenClipComments: (String) -> Unit = onOpenPost,
    onOpenProfile: (String) -> Unit,
    watchTrackingRepository: ClipWatchTrackingRepository = ClipWatchTrackingRepository(sessionProvider = { null }),
    initialClipId: String? = null,
    onInitialClipHandled: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var selectedTab by remember { mutableStateOf(ClipsFeedTab.FOR_YOU) }
    var items by remember { mutableStateOf<List<ClipFeedItem>>(emptyList()) }
    var nextCursor by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var loadingMore by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var hasLoaded by remember { mutableStateOf(false) }
    var muted by remember { mutableStateOf(true) }
    var requestGeneration by remember { mutableStateOf(0) }
    var actionMessage by remember { mutableStateOf<String?>(null) }
    var initialClipIndex by remember { mutableStateOf<Int?>(null) }
    val likedOverrides = remember { mutableStateMapOf<String, Boolean>() }
    val savedOverrides = remember { mutableStateMapOf<String, Boolean>() }
    val followingOverrides = remember { mutableStateMapOf<String, Boolean>() }
    val pendingActions = remember { mutableStateMapOf<String, Boolean>() }
    val context = LocalContext.current

    fun loadFirstPage(tab: ClipsFeedTab) {
        selectedTab = tab
        requestGeneration += 1
        val generation = requestGeneration
        items = emptyList()
        nextCursor = null
        loading = true
        loadingMore = false
        error = null
        actionMessage = null
        hasLoaded = false
        executor.execute {
            val response = repository.load(tab)
            Snapshot.withMutableSnapshot {
                if (requestGeneration == generation && selectedTab == tab) {
                    when (response) {
                        is ClipsResult.Success -> {
                            items = response.page.items
                            nextCursor = response.page.nextCursor
                            hasLoaded = true
                        }
                        is ClipsResult.Failure -> {
                            if (response.authenticationRequired && !isGuest) onReauthenticate()
                            else error = response.message
                        }
                    }
                    loading = false
                }
            }
        }
    }

    fun loadNextPage() {
        val cursor = nextCursor ?: return
        if (loading || loadingMore || selectedTab == ClipsFeedTab.FOLLOWING && isGuest) return
        val tab = selectedTab
        val generation = requestGeneration
        loadingMore = true
        executor.execute {
            val response = repository.load(tab, cursor)
            Snapshot.withMutableSnapshot {
                if (requestGeneration == generation && selectedTab == tab) {
                    when (response) {
                        is ClipsResult.Success -> {
                            val known = items.asSequence().map { it.post.id }.toHashSet()
                            items = items + response.page.items.filterNot { it.post.id in known }
                            nextCursor = response.page.nextCursor
                        }
                        is ClipsResult.Failure -> error = response.message
                    }
                    loadingMore = false
                }
            }
        }
    }

    fun togglePostAction(item: ClipFeedItem, action: String) {
        if (pendingActions[item.post.id] == true) return
        if (isGuest) {
            onSignInRequiredWithAction { }
            return
        }
        val currentlyActive = when (action) {
            "like" -> likedOverrides[item.post.id] ?: item.post.liked
            "save" -> savedOverrides[item.post.id] ?: item.post.bookmarked
            else -> followingOverrides[item.post.id] ?: item.isFollowingAuthor
        }
        pendingActions[item.post.id] = true
        actionMessage = null
        executor.execute {
            val result = when (action) {
                "like" -> postRepository.setLiked(item.post.id, !currentlyActive)
                "save" -> postRepository.setSaved(item.post.id, !currentlyActive)
                else -> null
            }
            val followResult = if (action == "follow") profileRepository.setFollow(item.post.authorId, !currentlyActive) else null
            Snapshot.withMutableSnapshot {
                pendingActions.remove(item.post.id)
                val succeeded = result?.isSuccess ?: (followResult is FollowActionResult.Success)
                if (succeeded) {
                    when (action) {
                        "like" -> likedOverrides[item.post.id] = !currentlyActive
                        "save" -> savedOverrides[item.post.id] = !currentlyActive
                        else -> followingOverrides[item.post.id] = !currentlyActive
                    }
                } else {
                    actionMessage = result?.exceptionOrNull()?.message
                        ?: (followResult as? FollowActionResult.Failure)?.message
                        ?: "Could not update this clip. Try again."
                }
            }
        }
    }

    LaunchedEffect(Unit) { loadFirstPage(ClipsFeedTab.FOR_YOU) }
    LaunchedEffect(initialClipId, items, nextCursor, hasLoaded, loadingMore, error) {
        val targetId = initialClipId ?: return@LaunchedEffect
        if (!hasLoaded || loadingMore) return@LaunchedEffect
        val targetIndex = items.indexOfFirst { it.post.id == targetId }
        when {
            targetIndex >= 0 -> {
                initialClipIndex = targetIndex
                onInitialClipHandled()
            }
            error != null || nextCursor == null -> {
                actionMessage = "That clip could not be found. Browse Clips and try again."
                onInitialClipHandled()
            }
            else -> loadNextPage()
        }
    }

    Surface(modifier = modifier.fillMaxSize(), color = androidx.compose.ui.graphics.Color.Black) {
        Column(Modifier.fillMaxSize().testTag("clips-screen")) {
            Row(
                modifier = Modifier.fillMaxWidth().height(56.dp).padding(start = 8.dp, end = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Clips", Modifier.weight(1f).semantics { heading() }, color = androidx.compose.ui.graphics.Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                IconButton(onClick = onOpenSearch, modifier = Modifier.testTag("clips-search")) {
                    Icon(Icons.Default.Search, contentDescription = "Search clips", tint = androidx.compose.ui.graphics.Color.White)
                }
            }
            TabRow(
                selectedTabIndex = ClipsFeedTab.entries.indexOf(selectedTab),
                containerColor = androidx.compose.ui.graphics.Color.Black,
                contentColor = androidx.compose.ui.graphics.Color.White,
            ) {
                ClipsFeedTab.entries.forEach { tab ->
                    Tab(
                        selected = selectedTab == tab,
                        onClick = {
                            if (tab == ClipsFeedTab.FOLLOWING && isGuest) {
                                onSignInRequiredWithAction { loadFirstPage(ClipsFeedTab.FOLLOWING) }
                            } else if (selectedTab != tab) loadFirstPage(tab)
                        },
                        text = { Text(if (tab == ClipsFeedTab.FOR_YOU) "For you" else "Following") },
                        modifier = Modifier.testTag("clips-tab-${tab.apiValue}"),
                    )
                }
            }
            actionMessage?.let {
                Text(it, Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
            when {
                loading && items.isEmpty() -> Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = MaterialTheme.colorScheme.primary) }
                error != null && items.isEmpty() -> ClipsEmptyState(
                    title = "Clips could not load",
                    message = error.orEmpty(),
                    buttonLabel = "Try again",
                    onAction = { loadFirstPage(selectedTab) },
                    modifier = Modifier.weight(1f),
                )
                hasLoaded && items.isEmpty() -> ClipsEmptyState(
                    title = if (selectedTab == ClipsFeedTab.FOR_YOU) "No clips yet" else "No clips from followed creators",
                    message = if (selectedTab == ClipsFeedTab.FOR_YOU) "Check back later for short videos from the Nantty community." else "Follow creators who share clips to see them here.",
                    buttonLabel = if (selectedTab == ClipsFeedTab.FOLLOWING) "Explore For you" else null,
                    onAction = { loadFirstPage(ClipsFeedTab.FOR_YOU) },
                    modifier = Modifier.weight(1f),
                )
                items.isNotEmpty() -> {
                    BoxWithConstraints(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                        val pageWidth = maxWidth.coerceAtMost(600.dp)
                        val pagerState = rememberPagerState(pageCount = { items.size })
                        LaunchedEffect(initialClipIndex) {
                            initialClipIndex?.let { index ->
                                if (index in items.indices) pagerState.scrollToPage(index)
                                initialClipIndex = null
                            }
                        }
                        LaunchedEffect(pagerState.currentPage, items.size) {
                            if (pagerState.currentPage >= items.lastIndex - 2) loadNextPage()
                        }
                        VerticalPager(
                            state = pagerState,
                            modifier = Modifier.widthIn(max = 600.dp).fillMaxWidth().height(maxHeight).testTag("clips-pager"),
                            key = { index -> items[index].post.id },
                        ) { index ->
                            val item = items[index]
                            ClipPagerPage(
                                item = item,
                                active = pagerState.currentPage == index,
                                liked = likedOverrides[item.post.id] ?: item.post.liked,
                                saved = savedOverrides[item.post.id] ?: item.post.bookmarked,
                                following = followingOverrides[item.post.id] ?: item.isFollowingAuthor,
                                muted = muted,
                                actionPending = pendingActions[item.post.id] == true,
                                onToggleMute = { muted = !muted },
                                onToggleLike = { togglePostAction(item, "like") },
                                onToggleSave = { togglePostAction(item, "save") },
                                onOpenComments = { onOpenClipComments(item.post.id) },
                                onShare = { sharePostFromAndroid(context, item.post.id, item.post.authorName) },
                                onOpenProfile = { onOpenProfile(item.post.authorId) },
                                onToggleFollow = { togglePostAction(item, "follow") },
                                watchTrackingRepository = watchTrackingRepository,
                                trackingExecutor = executor,
                                modifier = Modifier.widthIn(max = pageWidth).fillMaxSize(),
                            )
                        }
                        if (loadingMore) CircularProgressIndicator(Modifier.align(Alignment.BottomCenter).padding(bottom = 24.dp), color = MaterialTheme.colorScheme.primary)
                        if (error != null && items.isNotEmpty()) {
                            TextButton(onClick = { error = null; loadNextPage() }, modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 56.dp)) { Text("Could not load more · Retry") }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ClipsEmptyState(
    title: String,
    message: String,
    buttonLabel: String?,
    onAction: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier.fillMaxWidth().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
    ) {
        Text(title, color = androidx.compose.ui.graphics.Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        Text(message, color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.8f), style = MaterialTheme.typography.bodyMedium)
        if (buttonLabel != null) TextButton(onClick = onAction) { Text(buttonLabel) }
    }
}
