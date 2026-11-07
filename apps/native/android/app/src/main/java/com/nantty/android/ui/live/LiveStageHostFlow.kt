package com.nantty.android.ui.live

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.nantty.android.data.LiveSessionsResult
import com.nantty.android.data.LiveStageRepository
import com.nantty.android.data.LiveStageUserSummary
import com.nantty.android.data.LiveStageViewerSnapshot
import com.nantty.android.data.LiveStageInviteRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.util.concurrent.Executor

@Composable
internal fun LiveStageHostFlow(
    liveId: String,
    joined: Boolean,
    stage: LiveStageViewerSnapshot?,
    busy: Boolean,
    message: String?,
    repository: LiveStageRepository,
    executor: Executor,
    onStageChanged: (LiveStageViewerSnapshot) -> Unit,
    onBusyChanged: (Boolean) -> Unit,
    onError: (String?) -> Unit,
    onReauthenticate: () -> Unit,
) {
    var query by remember(liveId) { mutableStateOf("") }
    var viewers by remember(liveId) { mutableStateOf<List<LiveStageUserSummary>>(emptyList()) }
    var searching by remember(liveId) { mutableStateOf(false) }

    androidx.compose.runtime.LaunchedEffect(liveId, joined, stage?.myRole, query) {
        if (!joined || stage?.myRole != "host" || (query.isNotBlank() && query.trim().length < 2)) {
            viewers = emptyList()
            searching = false
            return@LaunchedEffect
        }
        delay(250)
        searching = true
        when (val result = withContext(Dispatchers.IO) { repository.searchViewers(liveId, query) }) {
            is LiveSessionsResult.Success -> viewers = result.value
            is LiveSessionsResult.Failure -> {
                viewers = emptyList()
                onError(result.message)
                if (result.authenticationRequired) onReauthenticate()
            }
        }
        searching = false
    }

    fun perform(action: () -> LiveSessionsResult<LiveStageViewerSnapshot>) {
        if (busy) return
        onBusyChanged(true)
        executor.execute {
            when (val result = action()) {
                is LiveSessionsResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    onStageChanged(result.value)
                    onError(null)
                    onBusyChanged(false)
                }
                is LiveSessionsResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    onError(result.message)
                    onBusyChanged(false)
                    if (result.authenticationRequired) onReauthenticate()
                }
            }
        }
    }

    LiveStageHostControls(
        stage = stage,
        viewers = viewers,
        searchQuery = query,
        searching = searching,
        busy = busy,
        message = message,
        onSearchChanged = { query = it.take(80) },
        onInvite = { request -> perform { repository.inviteViewer(liveId, request.userId, request.role, request.title) } },
        onApprove = { requestId -> perform { repository.decideJoinRequest(liveId, requestId, true) } },
        onDecline = { requestId -> perform { repository.decideJoinRequest(liveId, requestId, false) } },
        onRemove = { userId -> perform { repository.removeGuest(liveId, userId) } },
        onMute = { userId, audio, video -> perform { repository.muteStreamer(liveId, userId, audio, video) } },
    )
}
