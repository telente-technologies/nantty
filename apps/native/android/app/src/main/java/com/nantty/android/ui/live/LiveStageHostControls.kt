package com.nantty.android.ui.live

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.nantty.android.data.LiveStageJoinRequestSummary
import com.nantty.android.data.LIVE_STAGE_MAXIMUM_STREAMERS
import com.nantty.android.data.LiveStageStreamerSummary
import com.nantty.android.data.LiveStageUserSummary
import com.nantty.android.data.LiveStageViewerSnapshot

@Composable
@OptIn(ExperimentalMaterial3Api::class)
internal fun LiveStageHostControls(
    stage: LiveStageViewerSnapshot?,
    viewers: List<LiveStageUserSummary>,
    searchQuery: String,
    searching: Boolean,
    busy: Boolean,
    message: String?,
    onSearchChanged: (String) -> Unit,
    onInvite: (String) -> Unit,
    onApprove: (String) -> Unit,
    onDecline: (String) -> Unit,
    onRemove: (String) -> Unit,
    onMute: (String, Boolean?, Boolean?) -> Unit,
) {
    if (stage?.myRole != "host") return
    var sheetOpen by remember(stage.liveId) { mutableStateOf(false) }
    var pendingRemoval by remember(stage.liveId) { mutableStateOf<LiveStageUserSummary?>(null) }
    val reservedSeats = stage.streamers.size + stage.invitations.count { it.state == "invited" }
    OutlinedButton(onClick = { sheetOpen = true }, enabled = !busy, modifier = Modifier.fillMaxWidth().testTag("live-stage-manage")) {
        Text("Manage stage · $reservedSeats/$LIVE_STAGE_MAXIMUM_STREAMERS seats reserved")
    }
    if (sheetOpen) ModalBottomSheet(onDismissRequest = { if (!busy) sheetOpen = false }) {
        LazyColumn(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item { Text("On stage", style = MaterialTheme.typography.titleLarge) }
            items(stage.streamers, key = { it.slotId }) { streamer -> LiveStageStreamerRow(streamer, busy, { pendingRemoval = streamer.user }, onMute) }
            val pendingRequests = stage.joinRequests.filter { it.state == "pending" }
            if (pendingRequests.isNotEmpty()) item { Text("Requests to join (${pendingRequests.size})", style = MaterialTheme.typography.titleMedium) }
            items(pendingRequests, key = { "request-${it.id}" }) {
                LiveStageRequestRow(request = it, busy = busy, canApprove = stage.streamers.size < LIVE_STAGE_MAXIMUM_STREAMERS, onApprove = onApprove, onDecline = onDecline)
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Invite viewers", style = MaterialTheme.typography.titleMedium)
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = onSearchChanged,
                        enabled = !busy,
                        singleLine = true,
                        label = { Text("Search viewers") },
                        modifier = Modifier.fillMaxWidth().testTag("live-stage-viewer-search"),
                    )
                    if (searching) CircularProgressIndicator()
                    message?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                    if (reservedSeats >= LIVE_STAGE_MAXIMUM_STREAMERS) Text("The stage is full. Remove a guest to invite someone else.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            items(viewers, key = { "viewer-${it.id}" }) { viewer ->
                val invited = stage.invitations.any { it.user.id == viewer.id && it.state == "invited" }
                Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column(Modifier.weight(1f)) {
                            Text(viewer.name, style = MaterialTheme.typography.bodyLarge)
                            Text("@${viewer.username}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Button(
                            onClick = { onInvite(viewer.id) },
                            enabled = !busy && !invited && reservedSeats < LIVE_STAGE_MAXIMUM_STREAMERS,
                            modifier = Modifier.testTag("live-stage-invite-${viewer.id}"),
                        ) { Text(if (invited) "Invited" else "Invite") }
                    }
                }
            }
            item { TextButton(onClick = { sheetOpen = false }, enabled = !busy) { Text("Done") } }
        }
    }
    pendingRemoval?.let { guest ->
        AlertDialog(
            onDismissRequest = { if (!busy) pendingRemoval = null },
            title = { Text("Remove ${guest.name} from the stage?") },
            text = { Text("Their camera and microphone will stop showing, and they’ll return to watching.") },
            confirmButton = {
                Button(
                    onClick = { pendingRemoval = null; onRemove(guest.id) },
                    enabled = !busy,
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                    modifier = Modifier.testTag("live-stage-remove-confirm"),
                ) {
                    Text("Remove", color = MaterialTheme.colorScheme.onError)
                }
            },
            dismissButton = { TextButton(onClick = { pendingRemoval = null }, enabled = !busy) { Text("Cancel") } },
        )
    }
}

@Composable
private fun LiveStageStreamerRow(
    streamer: LiveStageStreamerSummary,
    busy: Boolean,
    onRemove: (String) -> Unit,
    onMute: (String, Boolean?, Boolean?) -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(streamer.user.name, style = MaterialTheme.typography.bodyLarge)
        Text("@${streamer.user.username} · ${if (streamer.role == "host") "Host" else "Guest"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (streamer.role == "guest") Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            TextButton(onClick = { onMute(streamer.user.id, !streamer.audioMuted, null) }, enabled = !busy) { Text(if (streamer.audioMuted) "Unmute" else "Mute") }
            TextButton(onClick = { onMute(streamer.user.id, null, !streamer.videoMuted) }, enabled = !busy) { Text(if (streamer.videoMuted) "Camera on" else "Camera off") }
            TextButton(onClick = { onRemove(streamer.user.id) }, enabled = !busy) { Text("Remove", color = MaterialTheme.colorScheme.error) }
        }
    }
}

@Composable
private fun LiveStageRequestRow(
    request: LiveStageJoinRequestSummary,
    busy: Boolean,
    canApprove: Boolean,
    onApprove: (String) -> Unit,
    onDecline: (String) -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(request.user.name, style = MaterialTheme.typography.bodyLarge)
        Text("@${request.user.username} wants to join", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = { onDecline(request.id) }, enabled = !busy) { Text("Decline") }
            Button(onClick = { onApprove(request.id) }, enabled = !busy && canApprove, modifier = Modifier.testTag("live-stage-approve-${request.id}")) { Text("Approve") }
        }
    }
}
