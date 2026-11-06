package com.nantty.android.ui.live

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.nantty.android.data.LiveStageViewerSnapshot

@Composable
internal fun LiveStageAudienceControls(
    stage: LiveStageViewerSnapshot?,
    busy: Boolean,
    canPublish: Boolean,
    microphoneEnabled: Boolean,
    cameraEnabled: Boolean,
    message: String?,
    onRequestToJoin: () -> Unit,
    onLeaveStage: () -> Unit,
    onToggleMicrophone: () -> Unit,
    onToggleCamera: () -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        when {
            canPublish -> {
                Text("You’re on stage", style = MaterialTheme.typography.titleMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = onToggleMicrophone, enabled = !busy, modifier = Modifier.weight(1f)) {
                        Text(if (microphoneEnabled) "Mute microphone" else "Unmute microphone")
                    }
                    OutlinedButton(onClick = onToggleCamera, enabled = !busy, modifier = Modifier.weight(1f)) {
                        Text(if (cameraEnabled) "Turn camera off" else "Turn camera on")
                    }
                }
                TextButton(onClick = onLeaveStage, enabled = !busy, modifier = Modifier.testTag("live-stage-leave")) {
                    Text("Leave stage")
                }
            }
            stage?.myRole == "viewer" && stage.invitationId == null && stage.joinRequestState != "pending" -> {
                Button(onClick = onRequestToJoin, enabled = !busy, modifier = Modifier.fillMaxWidth().testTag("live-stage-request")) {
                    Text(if (busy) "Sending request…" else "Request to join the stage")
                }
            }
            stage?.myRole == "viewer" && stage.joinRequestState == "pending" -> {
                Text("Your request to join is waiting for the host.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        message?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
internal fun LiveStageInvitationDialog(
    hostName: String,
    invitedByHost: Boolean,
    visible: Boolean,
    busy: Boolean,
    message: String?,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    if (!visible) return
    AlertDialog(
        onDismissRequest = { if (!busy) onDecline() },
        title = { Text(if (invitedByHost) "Stage invitation" else "Stage request approved") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(if (invitedByHost) "$hostName invited you to join this Live." else "$hostName approved your request to join this Live.")
                Text("Your camera and microphone will be shared with viewers. You can turn either off or leave the stage at any time.")
                message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = { Button(onClick = onAccept, enabled = !busy, modifier = Modifier.testTag("live-stage-accept")) { Text(if (busy) "Joining…" else "Join stage") } },
        dismissButton = { TextButton(onClick = onDecline, enabled = !busy, modifier = Modifier.testTag("live-stage-decline")) { Text("Not now") } },
    )
}
