package com.nantty.android.ui.stories

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.nantty.android.data.StoriesRepository
import com.nantty.android.data.ProductReportRepository
import com.nantty.android.data.StoryFeedResult
import com.nantty.android.data.StoryItem
import com.nantty.android.data.StoryDeleteResult
import com.nantty.android.data.StorySeenResult
import com.nantty.android.data.StoryAdsRepository
import com.nantty.android.data.StoryAdDecisionResult
import com.nantty.android.data.StoryAdDestination
import com.nantty.android.data.StoryDecidedAd
import com.nantty.android.R
import com.nantty.android.ui.clips.ClipVideoPlayer
import java.util.concurrent.Executor
import java.time.Instant
import kotlinx.coroutines.delay
import java.util.concurrent.atomic.AtomicInteger

@Composable
internal fun StoryViewerDialog(
    repository: StoriesRepository,
    userId: String,
    executor: Executor,
    adsRepository: StoryAdsRepository? = null,
    adSession: StoryAdSession? = null,
    startAtLast: Boolean = false,
    onClose: () -> Unit,
    onPreviousUser: () -> Unit = {},
    onNextUser: () -> Unit = onClose,
    onReauthenticate: () -> Unit,
    onOpenAdDestination: (StoryAdDestination) -> Unit = {},
) {
    val activeAdSession = adSession ?: remember(repository, userId) { StoryAdSession() }
    var result by remember(repository, userId) { mutableStateOf<StoryFeedResult?>(null) }
    var activeIndex by remember(userId) { mutableIntStateOf(0) }
    var refreshGeneration by remember(userId) { mutableIntStateOf(0) }
    var analyticsStory by remember(userId) { mutableStateOf<StoryItem?>(null) }
    var reportStory by remember(userId) { mutableStateOf<StoryItem?>(null) }
    var deleteStory by remember(userId) { mutableStateOf<StoryItem?>(null) }
    var deletingStory by remember(userId) { mutableStateOf(false) }
    var deleteStoryError by remember(userId) { mutableStateOf<String?>(null) }
    var sponsoredAd by remember(userId, activeAdSession.sessionId) { mutableStateOf<StoryDecidedAd?>(null) }
    val reportRepository = remember(repository) { ProductReportRepository(accessTokenProvider = repository::currentAccessToken) }
    val requestGeneration = remember(repository) { AtomicInteger() }
    val sessionOffset = remember(userId, activeAdSession.sessionId) { activeAdSession.viewedCount }
    DisposableEffect(repository) {
        onDispose { requestGeneration.incrementAndGet() }
    }

    LaunchedEffect(repository, userId, refreshGeneration, startAtLast) {
        result = null
        val request = requestGeneration.incrementAndGet()
        executor.execute {
            val loaded = repository.loadUserStories(userId)
            if (requestGeneration.get() != request) return@execute
            Snapshot.withMutableSnapshot {
                result = loaded
                activeIndex = if (startAtLast && loaded is StoryFeedResult.Success) loaded.stories.lastIndex.coerceAtLeast(0) else 0
            }
        }
    }

    val stories = (result as? StoryFeedResult.Success)?.stories.orEmpty()
    val story = stories.getOrNull(activeIndex)

    LaunchedEffect(stories, sessionOffset, adsRepository, activeAdSession.sessionId) {
        val ads = adsRepository ?: return@LaunchedEffect
        val sessionId = activeAdSession.sessionId
        storyAdSlotsForStories(sessionOffset, stories.size).forEach { slot ->
            val storyIndex = slot - sessionOffset - 1
            val target = stories.getOrNull(storyIndex) ?: return@forEach
            if (!activeAdSession.requestSlotOnce(slot)) return@forEach
            val neighbours = listOfNotNull(stories.getOrNull(storyIndex - 1)?.id, stories.getOrNull(storyIndex + 1)?.id).take(10)
            val slotsSinceLastAd = storySlotsSinceLastAd(slot, activeAdSession.lastAdViewedAt)
            executor.execute {
                when (val decision = ads.decideStoryAd(target.id, sessionId, slotsSinceLastAd, neighbours, slot)) {
                    is StoryAdDecisionResult.Success -> decision.ad?.let { activeAdSession.cacheAd(slot, it, sessionId) }
                    is StoryAdDecisionResult.Failure -> if (decision.authenticationRequired) onReauthenticate()
                }
            }
        }
    }

    fun advancePastCurrentStory() {
        if (activeIndex < stories.lastIndex) activeIndex += 1 else onNextUser()
    }

    fun advanceStoryOrShowAd() {
        if (sponsoredAd != null) {
            sponsoredAd = null
            advancePastCurrentStory()
            return
        }
        val slot = sessionOffset + activeIndex + 1
        val ad = activeAdSession.adsBySlot[slot]
        val adNotExpired = ad?.let { runCatching { Instant.parse(it.expiresAt).toEpochMilli() > System.currentTimeMillis() }.getOrDefault(false) } == true
        if (ad != null && adNotExpired && !activeAdSession.hasViewedAd(slot) && activeAdSession.markAdViewed(slot)) {
            sponsoredAd = ad
        } else {
            advancePastCurrentStory()
        }
    }

    val advanceLatest by rememberUpdatedState(newValue = { advanceStoryOrShowAd() })
    LaunchedEffect(story?.id) {
        if (story == null || story.seen) return@LaunchedEffect
        activeAdSession.recordStoryViewed()
        executor.execute {
            val seenResult = repository.markSeen(story.id)
            if (seenResult is StorySeenResult.Failure && seenResult.authenticationRequired) {
                Snapshot.withMutableSnapshot { onReauthenticate() }
            }
        }
    }
    LaunchedEffect(story?.id, story?.media?.type, sponsoredAd) {
        if (sponsoredAd != null || story?.media?.type != "image") return@LaunchedEffect
        delay(5_000)
        advanceLatest()
    }

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.48f)), contentAlignment = Alignment.Center) {
            Surface(
                modifier = Modifier
                    .widthIn(max = 520.dp)
                    .fillMaxWidth()
                    .fillMaxHeight(0.96f)
                    .testTag("story-viewer"),
                shape = MaterialTheme.shapes.large,
                color = Color.Black,
            ) {
                when (val current = result) {
                    null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Color.White) }
                    is StoryFeedResult.Failure -> Column(
                        Modifier.fillMaxSize().padding(24.dp),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(current.message, color = Color.White, style = MaterialTheme.typography.bodyLarge)
                        if (current.authenticationRequired) TextButton(onClick = onReauthenticate) { Text("Sign in", color = Color.White) }
                        else TextButton(onClick = { refreshGeneration++ }) { Text("Try again", color = Color.White) }
                        TextButton(onClick = onClose) { Text("Close", color = Color.White) }
                    }
                    is StoryFeedResult.Success -> if (current.stories.isEmpty()) {
                        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("No stories right now", color = Color.White)
                            TextButton(onClick = onClose) { Text("Close", color = Color.White) }
                        }
                    } else if (sponsoredAd != null && adsRepository != null) {
                        SponsoredStoryPage(
                            ad = sponsoredAd!!,
                            repository = adsRepository,
                            executor = executor,
                            onFinished = { advanceStoryOrShowAd() },
                            onOpenDestination = onOpenAdDestination,
                        )
                    } else {
                        StoryPage(
                            story = current.stories[activeIndex.coerceIn(current.stories.indices)],
                            count = current.stories.size,
                            activeIndex = activeIndex,
                            onPrevious = { if (activeIndex > 0) activeIndex-- else onPreviousUser() },
                            onNext = ::advanceStoryOrShowAd,
                            onClose = onClose,
                            onOpenAnalytics = { analyticsStory = it.takeIf(repository::canOpenOwnerAnalytics) },
                            canOpenAnalytics = repository::canOpenOwnerAnalytics,
                            canDeleteStory = repository::canOpenOwnerAnalytics,
                            onDeleteStory = { deleteStory = it; deleteStoryError = null },
                            canReportAuthor = { !repository.canOpenOwnerAnalytics(it) },
                            onReportAuthor = { reportStory = it },
                        )
                    }
                }
            }
        }
    }
    analyticsStory?.let { selectedStory ->
        StoryAnalyticsDialog(repository, selectedStory, executor, onDismiss = { analyticsStory = null }, onReauthenticate = onReauthenticate)
    }
    reportStory?.let { selectedStory ->
        StoryReportDialog(reportRepository, selectedStory, executor, onDismiss = { reportStory = null }, onReauthenticate = onReauthenticate)
    }
    deleteStory?.let { selectedStory ->
        AlertDialog(
            onDismissRequest = { if (!deletingStory) deleteStory = null },
            title = { Text("Delete story?") },
            text = {
                Column {
                    Text("This can't be undone.")
                    deleteStoryError?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp)) }
                }
            },
            confirmButton = {
                TextButton(enabled = !deletingStory, onClick = {
                    deletingStory = true
                    deleteStoryError = null
                    executor.execute {
                        val outcome = repository.deleteOwnStory(selectedStory.id)
                        Snapshot.withMutableSnapshot {
                            deletingStory = false
                            when (outcome) {
                                StoryDeleteResult.Success -> {
                                    deleteStory = null
                                    refreshGeneration++
                                }
                                is StoryDeleteResult.Failure -> {
                                    if (outcome.authenticationRequired) onReauthenticate()
                                    deleteStoryError = outcome.message
                                }
                            }
                        }
                    }
                }) { Text(if (deletingStory) "Deleting…" else "Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(enabled = !deletingStory, onClick = { deleteStory = null }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun StoryPage(
    story: StoryItem,
    count: Int,
    activeIndex: Int,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onClose: () -> Unit,
    canOpenAnalytics: (StoryItem) -> Boolean,
    onOpenAnalytics: (StoryItem) -> Unit,
    canDeleteStory: (StoryItem) -> Boolean,
    onDeleteStory: (StoryItem) -> Unit,
    canReportAuthor: (StoryItem) -> Boolean,
    onReportAuthor: (StoryItem) -> Unit,
) {
    var optionsExpanded by remember(story.id) { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        if (story.media.type == "video") {
            ClipVideoPlayer(
                videoUrl = story.media.url,
                muted = true,
                isActive = true,
                modifier = Modifier.fillMaxSize(),
                loop = false,
                onPlaybackFinished = onNext,
            )
        } else {
            AsyncImage(
                model = story.media.url,
                contentDescription = "Story by ${story.authorName}",
                modifier = Modifier.fillMaxSize(),
                contentScale = androidx.compose.ui.layout.ContentScale.Fit,
            )
        }
        Column(Modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 10.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                repeat(count) { index ->
                    val progressColor = if (index <= activeIndex) Color.White else Color.White.copy(alpha = 0.38f)
                    Box(Modifier.weight(1f).height(3.dp).background(progressColor, MaterialTheme.shapes.small))
                }
            }
            Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(story.authorName, color = Color.White, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Text(story.sound?.title ?: story.username.let { if (it.isBlank()) "Story" else "@$it" }, color = Color.White.copy(alpha = 0.8f), style = MaterialTheme.typography.labelSmall)
                }
                IconButton(onClick = { optionsExpanded = true }, modifier = Modifier.semantics { contentDescription = "Story options" }.testTag("story-options")) {
                    Icon(Icons.Default.MoreVert, contentDescription = null, tint = Color.White)
                }
                DropdownMenu(expanded = optionsExpanded, onDismissRequest = { optionsExpanded = false }) {
                    if (canOpenAnalytics(story)) {
                        DropdownMenuItem(
                            text = { Text("Story analytics") },
                            onClick = { optionsExpanded = false; onOpenAnalytics(story) },
                            modifier = Modifier.testTag("story-options-analytics"),
                        )
                    }
                    if (canDeleteStory(story)) {
                        DropdownMenuItem(
                            text = { Text("Delete story", color = MaterialTheme.colorScheme.error) },
                            onClick = { optionsExpanded = false; onDeleteStory(story) },
                            modifier = Modifier.testTag("story-options-delete"),
                        )
                    }
                    if (canReportAuthor(story)) {
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.story_report_author_action)) },
                            onClick = { optionsExpanded = false; onReportAuthor(story) },
                            modifier = Modifier.testTag("story-options-report"),
                        )
                    }
                }
                IconButton(onClick = onClose, modifier = Modifier.semantics { contentDescription = "Close stories" }) {
                    Icon(Icons.Default.Close, contentDescription = null, tint = Color.White)
                }
            }
        }
        Row(Modifier.fillMaxSize()) {
            Box(
                Modifier.weight(0.32f).fillMaxHeight().clickable(onClick = onPrevious).testTag("story-previous"),
            )
            Box(
                Modifier.weight(0.68f).fillMaxHeight().clickable(onClick = onNext).testTag("story-next"),
            )
        }
        if (canReportAuthor(story)) {
            TextButton(
                onClick = { onReportAuthor(story) },
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 20.dp).testTag("story-report-author"),
            ) { Text(stringResource(R.string.story_report_author_action), color = Color.White) }
        }
    }
}
