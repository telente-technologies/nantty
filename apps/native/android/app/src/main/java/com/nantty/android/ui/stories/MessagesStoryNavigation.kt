package com.nantty.android.ui.stories

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
import com.nantty.android.data.StoriesRepository
import com.nantty.android.data.StoryAdsRepository
import com.nantty.android.data.StoryTrayEntry
import com.nantty.android.data.StoryTrayResult
import com.nantty.android.data.LiveSessionsRepository
import com.nantty.android.data.LiveSessionsResult
import com.nantty.android.data.SuggestedLiveCard
import java.util.concurrent.Executor
import java.util.concurrent.atomic.AtomicInteger

internal data class StoryAuthorTarget(val userId: String, val startAtLast: Boolean)

internal fun adjacentStoryAuthor(
    entries: List<StoryTrayEntry>,
    currentUserId: String,
    next: Boolean,
): StoryAuthorTarget? {
    val currentIndex = entries.indexOfFirst { it.userId == currentUserId }
    if (currentIndex < 0) {
        if (!next) return null
        return entries.firstOrNull()?.let { StoryAuthorTarget(it.userId, startAtLast = false) }
    }
    val targetIndex = if (next) currentIndex + 1 else currentIndex - 1
    val target = entries.getOrNull(targetIndex) ?: return null
    return StoryAuthorTarget(target.userId, startAtLast = !next)
}

internal data class MessagesStoryNavigationState(
    val trayResult: StoryTrayResult?,
    val liveEntries: List<SuggestedLiveCard>,
    val selectedStoryUserId: String?,
    val startAtLast: Boolean,
    val adSession: StoryAdSession,
    val refreshTray: () -> Unit,
    val openStory: (String) -> Unit,
    val nextAuthor: () -> Unit,
    val previousAuthor: () -> Unit,
    val closeViewer: () -> Unit,
)

@Composable
internal fun rememberMessagesStoryNavigation(
    repository: StoriesRepository?,
    adsRepository: StoryAdsRepository?,
    liveSessionsRepository: LiveSessionsRepository?,
    executor: Executor,
    onReauthenticate: () -> Unit,
): MessagesStoryNavigationState {
    var trayResult by remember(repository) { mutableStateOf<StoryTrayResult?>(null) }
    var liveEntries by remember(repository, liveSessionsRepository) { mutableStateOf<List<SuggestedLiveCard>>(emptyList()) }
    var selectedStoryUserId by remember(repository) { mutableStateOf<String?>(null) }
    var startAtLast by remember(repository) { mutableStateOf(false) }
    var refreshGeneration by remember(repository) { mutableIntStateOf(0) }
    val adSession = remember(repository) { StoryAdSession() }
    val requestGeneration = remember(repository) { AtomicInteger() }
    val latestReauthenticate by rememberUpdatedState(onReauthenticate)
    DisposableEffect(repository, liveSessionsRepository) {
        onDispose { requestGeneration.incrementAndGet() }
    }

    LaunchedEffect(repository, liveSessionsRepository, refreshGeneration) {
        val stories = repository
        val lives = liveSessionsRepository
        if (stories == null && lives == null) return@LaunchedEffect
        val request = requestGeneration.incrementAndGet()
        executor.execute {
            val loaded = stories?.loadTray()
            val loadedLives = lives?.suggested() as? LiveSessionsResult.Success
            if (requestGeneration.get() != request) return@execute
            Snapshot.withMutableSnapshot {
                loaded?.let {
                    trayResult = it
                    if (it is StoryTrayResult.Failure && it.authenticationRequired) latestReauthenticate()
                }
                loadedLives?.let { liveEntries = it.value.items }
            }
        }
    }

    val entries = (trayResult as? StoryTrayResult.Success)?.entries.orEmpty()
    return remember(repository, adsRepository, liveSessionsRepository, executor, trayResult, liveEntries, selectedStoryUserId, startAtLast, refreshGeneration, adSession) {
        MessagesStoryNavigationState(
            trayResult = trayResult,
            liveEntries = liveEntries,
            selectedStoryUserId = selectedStoryUserId,
            startAtLast = startAtLast,
            adSession = adSession,
            refreshTray = { refreshGeneration++ },
            openStory = { userId -> selectedStoryUserId = userId; startAtLast = false },
            nextAuthor = {
                selectedStoryUserId?.let { current ->
                    val target = adjacentStoryAuthor(entries, current, next = true)
                    selectedStoryUserId = target?.userId
                    startAtLast = target?.startAtLast ?: false
                    if (target == null) adSession.reset()
                }
            },
            previousAuthor = {
                selectedStoryUserId?.let { current -> adjacentStoryAuthor(entries, current, next = false) }?.let {
                    selectedStoryUserId = it.userId
                    startAtLast = it.startAtLast
                }
            },
            closeViewer = { selectedStoryUserId = null; startAtLast = false; adSession.reset(); refreshGeneration++ },
        )
    }
}

@Composable
internal fun MessagesStoryViewer(
    repository: StoriesRepository?,
    adsRepository: StoryAdsRepository?,
    executor: Executor,
    state: MessagesStoryNavigationState,
    onReauthenticate: () -> Unit,
    onOpenAdDestination: (com.nantty.android.data.StoryAdDestination) -> Unit,
) {
    val userId = state.selectedStoryUserId ?: return
    val activeRepository = repository ?: return
    StoryViewerDialog(
        repository = activeRepository,
        adsRepository = adsRepository,
        adSession = state.adSession,
        userId = userId,
        executor = executor,
        startAtLast = state.startAtLast,
        onClose = state.closeViewer,
        onPreviousUser = state.previousAuthor,
        onNextUser = state.nextAuthor,
        onReauthenticate = onReauthenticate,
        onOpenAdDestination = onOpenAdDestination,
    )
}
