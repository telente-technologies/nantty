package com.nantty.android.ui.live

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.LiveCoinTipReceipt
import com.nantty.android.data.LiveCoinTipRepository
import com.nantty.android.data.LiveCoinTipResult
import com.nantty.android.data.LiveComment
import com.nantty.android.data.LiveCommentsRepository
import com.nantty.android.data.LiveCommentsResult
import com.nantty.android.data.LiveMediaGrant
import com.nantty.android.data.LiveSessionSnapshot
import com.nantty.android.data.LiveSessionsRepository
import com.nantty.android.data.LiveSessionsResult
import com.nantty.android.data.LiveStageRepository
import com.nantty.android.data.LiveStageViewerSnapshot
import com.nantty.android.data.ProductReportRepository
import io.livekit.android.compose.local.RoomScope
import io.livekit.android.compose.state.rememberTracks
import io.livekit.android.compose.ui.VideoTrackView
import java.util.UUID
import java.util.concurrent.Executor
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Authenticated viewer route for an ordinary live; Spaces keep their independent audio-session flow. */
@Composable
internal fun LiveWatchScreen(
    liveId: String,
    sessions: LiveSessionsRepository,
    coinTips: LiveCoinTipRepository,
    comments: LiveCommentsRepository,
    stage: LiveStageRepository,
    reports: ProductReportRepository?,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var session by remember(liveId) { mutableStateOf<LiveSessionSnapshot?>(null) }
    var mediaGrant by remember(liveId) { mutableStateOf<LiveMediaGrant?>(null) }
    var joined by remember(liveId) { mutableStateOf(false) }
    var loading by remember(liveId) { mutableStateOf(true) }
    var working by remember(liveId) { mutableStateOf(false) }
    var error by remember(liveId) { mutableStateOf<String?>(null) }
    var receipt by remember(liveId) { mutableStateOf<LiveCoinTipReceipt?>(null) }
    var selectedCoins by remember(liveId) { mutableStateOf(100L) }
    var donationNote by remember(liveId) { mutableStateOf("") }
    var liveComments by remember(liveId) { mutableStateOf(emptyList<LiveComment>()) }
    var commentsLoading by remember(liveId) { mutableStateOf(false) }
    var commentsError by remember(liveId) { mutableStateOf<String?>(null) }
    var olderCommentsCursor by remember(liveId) { mutableStateOf<String?>(null) }
    var olderCommentsLoading by remember(liveId) { mutableStateOf(false) }
    var olderCommentsError by remember(liveId) { mutableStateOf<String?>(null) }
    var commentDraft by remember(liveId) { mutableStateOf("") }
    var commentSending by remember(liveId) { mutableStateOf(false) }
    var stageSnapshot by remember(liveId) { mutableStateOf<LiveStageViewerSnapshot?>(null) }
    var stageActionWorking by remember(liveId) { mutableStateOf(false) }
    var stageError by remember(liveId) { mutableStateOf<String?>(null) }
    var stageMicrophoneEnabled by remember(liveId) { mutableStateOf(false) }
    var stageCameraEnabled by remember(liveId) { mutableStateOf(false) }
    var reportVisible by remember(liveId) { mutableStateOf(false) }
    val latestStageSnapshot by rememberUpdatedState(stageSnapshot)
    fun loadLiveComments(cursor: String? = null, older: Boolean = false) {
        if (!joined || commentsLoading || (older && olderCommentsLoading)) return
        if (older) {
            if (cursor == null) return
            olderCommentsLoading = true
            olderCommentsError = null
        } else {
            commentsLoading = true
        }
        executor.execute {
            when (val result = comments.list(liveId, cursor)) {
                is LiveCommentsResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    val rows = result.value.comments.filterNot { it.kind == "gift" }
                    liveComments = mergeLiveCommentHistory(liveComments, rows)
                    if (older) {
                        olderCommentsCursor = result.value.nextCursor
                        olderCommentsError = null
                        olderCommentsLoading = false
                    } else {
                        if (olderCommentsCursor == null) olderCommentsCursor = result.value.nextCursor
                        commentsError = null
                        commentsLoading = false
                    }
                }
                is LiveCommentsResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    if (older) {
                        olderCommentsError = result.message
                        olderCommentsLoading = false
                    } else {
                        commentsError = result.message
                        commentsLoading = false
                    }
                    if (result.authenticationRequired) onReauthenticate()
                }
            }
        }
    }

    fun sendLiveComment() {
        val text = commentDraft.trim()
        if (text.isEmpty() || commentSending) return
        commentSending = true
        commentsError = null
        executor.execute {
            when (val result = comments.create(liveId, text)) {
                is LiveCommentsResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    liveComments = mergeLiveCommentHistory(liveComments, listOf(result.value))
                    commentDraft = ""
                    commentSending = false
                    commentsError = null
                }
                is LiveCommentsResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    commentsError = result.message
                    commentSending = false
                    if (result.authenticationRequired) onReauthenticate()
                }
            }
        }
    }

    LaunchedEffect(liveId, joined) {
        if (!joined) return@LaunchedEffect
        while (isActive) {
            loadLiveComments()
            delay(LIVE_COMMENTS_REFRESH_INTERVAL_MS)
        }
    }

    LaunchedEffect(liveId, joined, stage) {
        if (!joined) return@LaunchedEffect
        while (isActive) {
            if (!stageActionWorking) {
                when (val result = withContext(Dispatchers.IO) { stage.load(liveId) }) {
                    is LiveSessionsResult.Success -> {
                        stageSnapshot = result.value
                    }
                    is LiveSessionsResult.Failure -> {
                        stageError = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
            }
            delay(LIVE_STAGE_REFRESH_INTERVAL_MS)
        }
    }

    LaunchedEffect(liveId, sessions) {
        loading = true
        executor.execute {
            when (val result = sessions.load(liveId)) {
                is LiveSessionsResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    session = result.value
                    error = null
                    loading = false
                    if (result.value.accessAllowed.not()) error = "Follow or subscribe to this host before watching."
                }
                is LiveSessionsResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    error = result.message
                    loading = false
                    if (result.authenticationRequired) onReauthenticate()
                }
            }
        }
    }

    androidx.compose.runtime.DisposableEffect(liveId, joined, sessions) {
        onDispose {
            if (joined) executor.execute {
                if (latestStageSnapshot?.myRole == "guest") stage.leaveStage(liveId)
                sessions.leave(liveId)
            }
        }
    }

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 12.dp)) {
        TextButton(onClick = onBack) { Text("Back") }
        when {
            loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            session == null -> LiveLoadError(error = error ?: "This Live could not be loaded.", onRetry = {
                loading = true
                executor.execute {
                    when (val result = sessions.load(liveId)) {
                        is LiveSessionsResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot { session = result.value; error = null; loading = false }
                        is LiveSessionsResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot { error = result.message; loading = false; if (result.authenticationRequired) onReauthenticate() }
                    }
                }
            })
            else -> {
                val current = session!!
                Text(current.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(4.dp))
                Text("@${current.host.username} · ${current.viewers} watching", color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (reports != null) {
                    TextButton(onClick = { reportVisible = true }, modifier = Modifier.testTag("live-report-open")) {
                        Text(stringResource(com.nantty.android.R.string.live_report_action))
                    }
                    LiveHostAccountReportAction(liveId, current.host.id, current.host.username, reports, executor, onReauthenticate)
                }
                Spacer(Modifier.height(12.dp))

                if (!joined || mediaGrant == null) {
                    Card(Modifier.fillMaxWidth().height(240.dp)) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(if (current.status == "live") "Join to watch this Live" else "This Live is ${current.status}.")
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    Button(
                        onClick = {
                            if (!current.accessAllowed) return@Button
                            working = true
                            error = null
                            executor.execute {
                                when (val joinResult = sessions.join(liveId)) {
                                    is LiveSessionsResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                        working = false
                                        error = joinResult.message
                                        if (joinResult.authenticationRequired) onReauthenticate()
                                    }
                                    is LiveSessionsResult.Success -> when (val tokenResult = sessions.issueMediaToken(liveId)) {
                                        is LiveSessionsResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                            joined = true
                                            mediaGrant = tokenResult.value
                                            working = false
                                        }
                                        is LiveSessionsResult.Failure -> {
                                            sessions.leave(liveId)
                                            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                                working = false
                                                error = tokenResult.message
                                                if (tokenResult.authenticationRequired) onReauthenticate()
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        enabled = !working && current.status == "live" && current.accessAllowed,
                        modifier = Modifier.fillMaxWidth().testTag("live-watch-join"),
                    ) {
                        if (working) CircularProgressIndicator() else Text(if (current.accessAllowed) "Join Live" else "Access required")
                    }
                    if (!current.accessAllowed) TextButton(onClick = onBack) { Text("Back to Nantty") }
                } else {
                    mediaGrant?.let { grant ->
                        Card(Modifier.fillMaxWidth().height(280.dp).testTag("live-media-stage")) {
                            RoomScope(
                                url = grant.url,
                                token = grant.token,
                                audio = grant.canPublish && stageMicrophoneEnabled,
                                video = grant.canPublish && stageCameraEnabled,
                                connect = true,
                                disconnectOnDispose = true,
                            ) {
                                val tracks by rememberTracks()
                                Box(Modifier.fillMaxSize()) {
                                    if (tracks.isEmpty()) {
                                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                            Text("Connected · waiting for the host’s video", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        }
                                    } else {
                                        LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                            items(tracks.size) { index ->
                                                VideoTrackView(trackReference = tracks[index], modifier = Modifier.fillMaxWidth().height(240.dp))
                                            }
                                        }
                                    }
                                    LiveCommentsPanel(
                                        comments = liveComments,
                                        loading = commentsLoading,
                                        error = commentsError,
                                        hasOlderComments = olderCommentsCursor != null,
                                        loadingOlderComments = olderCommentsLoading,
                                        olderCommentsError = olderCommentsError,
                                        draft = commentDraft,
                                        sending = commentSending,
                                        onDraftChanged = { commentDraft = it },
                                        onRetry = { loadLiveComments() },
                                        onLoadOlderComments = { loadLiveComments(olderCommentsCursor, older = true) },
                                        onSend = ::sendLiveComment,
                                        modifier = Modifier
                                            .align(Alignment.BottomCenter)
                                            .fillMaxWidth()
                                            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.92f))
                                            .padding(horizontal = 12.dp),
                                    )
                                }
                            }
                        }
                    }
                    LiveStageAudienceControls(
                        stage = stageSnapshot,
                        busy = stageActionWorking,
                        canPublish = mediaGrant?.canPublish == true,
                        microphoneEnabled = stageMicrophoneEnabled,
                        cameraEnabled = stageCameraEnabled,
                        message = stageError,
                        onRequestToJoin = {
                            if (!stageActionWorking) {
                                stageActionWorking = true
                                executor.execute {
                                    when (val result = stage.requestToJoin(liveId)) {
                                        is LiveSessionsResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                            stageSnapshot = result.value
                                            stageError = null
                                            stageActionWorking = false
                                        }
                                        is LiveSessionsResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                            stageError = result.message
                                            stageActionWorking = false
                                            if (result.authenticationRequired) onReauthenticate()
                                        }
                                    }
                                }
                            }
                        },
                        onLeaveStage = {
                            stageActionWorking = true
                            executor.execute {
                                when (val result = stage.leaveStage(liveId)) {
                                    is LiveSessionsResult.Success -> when (val grantResult = sessions.issueMediaToken(liveId)) {
                                        is LiveSessionsResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                            stageSnapshot = result.value
                                            mediaGrant = grantResult.value
                                            stageMicrophoneEnabled = false
                                            stageCameraEnabled = false
                                            stageError = null
                                            stageActionWorking = false
                                        }
                                        is LiveSessionsResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                            stageSnapshot = result.value
                                            mediaGrant = null
                                            stageError = grantResult.message
                                            stageActionWorking = false
                                        }
                                    }
                                    is LiveSessionsResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                        stageError = result.message
                                        stageActionWorking = false
                                    }
                                }
                            }
                        },
                        onToggleMicrophone = { stageMicrophoneEnabled = !stageMicrophoneEnabled },
                        onToggleCamera = { stageCameraEnabled = !stageCameraEnabled },
                    )
                    LiveStageHostFlow(
                        liveId = liveId,
                        joined = joined,
                        stage = stageSnapshot,
                        busy = stageActionWorking,
                        message = stageError,
                        repository = stage,
                        executor = executor,
                        onStageChanged = { stageSnapshot = it },
                        onBusyChanged = { stageActionWorking = it },
                        onError = { stageError = it },
                        onReauthenticate = onReauthenticate,
                    )
                    Spacer(Modifier.height(12.dp))
                    if (current.coinSupportEnabled) {
                        Text("Support the host with coins", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(vertical = 8.dp)) {
                            listOf(100L, 500L, 1_000L).forEach { amount ->
                                if (selectedCoins == amount) Button(onClick = { selectedCoins = amount }) { Text("$amount") }
                                else OutlinedButton(onClick = { selectedCoins = amount }) { Text("$amount") }
                            }
                        }
                        LiveCoinDonationNoteField(
                            note = donationNote,
                            onNoteChanged = { donationNote = it },
                            enabled = !working,
                        )
                        Button(
                            onClick = {
                                working = true
                                error = null
                                receipt = null
                                val key = UUID.randomUUID().toString()
                                executor.execute {
                                    when (val result = coinTips.donate(liveId, selectedCoins, key, donationNote)) {
                                        is LiveCoinTipResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                            receipt = result.receipt
                                            donationNote = ""
                                            working = false
                                        }
                                        is LiveCoinTipResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                            error = result.message
                                            working = false
                                            if (result.authenticationRequired) onReauthenticate()
                                        }
                                    }
                                }
                            },
                            enabled = !working,
                            modifier = Modifier.fillMaxWidth().testTag("live-coin-donation"),
                        ) { Text(if (working) "Sending…" else "Send $selectedCoins coins") }
                        receipt?.let { Text("${it.coins} coins sent · balance ${it.coinBalance}", color = MaterialTheme.colorScheme.primary) }
                    } else {
                        Text("Coin support is turned off by the host.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp)) }
                }
            }
        }
    }

    LiveStageInvitationFlow(
        liveId = liveId,
        hostName = session?.host?.name.orEmpty(),
        joined = joined,
        stageSnapshot = stageSnapshot,
        mediaGrant = mediaGrant,
        busy = stageActionWorking,
        stage = stage,
        sessions = sessions,
        executor = executor,
        onBusyChanged = { stageActionWorking = it },
        onStageChanged = { stageSnapshot = it },
        onMediaGrantChanged = { mediaGrant = it },
        onPublishingEnabled = {
            stageMicrophoneEnabled = it
            stageCameraEnabled = it
        },
        onError = { stageError = it },
        onReauthenticate = onReauthenticate,
    )
    reports?.let { reportRepository ->
        LiveReportDialog(
            visible = reportVisible,
            liveId = liveId,
            liveStartedAt = session?.startedAt,
            repository = reportRepository,
            executor = executor,
            onDismiss = { reportVisible = false },
            onReauthenticate = onReauthenticate,
        )
    }
}

private const val LIVE_COMMENTS_REFRESH_INTERVAL_MS = 3_000L
private const val LIVE_STAGE_REFRESH_INTERVAL_MS = 1_000L

@Composable
private fun LiveLoadError(error: String, onRetry: () -> Unit) {
    Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(error, color = MaterialTheme.colorScheme.error)
        TextButton(onClick = onRetry) { Text("Try again") }
    }
}
