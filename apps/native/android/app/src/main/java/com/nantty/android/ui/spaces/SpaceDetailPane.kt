package com.nantty.android.ui.spaces

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.SpaceDetails
import com.nantty.android.data.SpaceRole
import com.nantty.android.data.SpaceState

@Composable
internal fun SpaceDetailPane(
    details: SpaceDetails?,
    loading: Boolean,
    viewerId: String?,
    accessToken: String?,
    working: Boolean,
    onSignInRequired: () -> Unit,
    onJoin: (String) -> Unit,
    onLeave: (String) -> Unit,
    onRequestSpeaker: (String) -> Unit,
    onApprove: (String, String) -> Unit,
    onDecline: (String, String) -> Unit,
    onMute: (String, String, Boolean) -> Unit,
    onDemote: (String, String) -> Unit,
    onRemove: (String, String) -> Unit,
    onToggleDonations: (String, Boolean) -> Unit,
    onStart: (String) -> Unit,
    onEnd: (String) -> Unit,
    onCancel: (String) -> Unit,
    onInvite: () -> Unit,
    onDonate: () -> Unit,
    onReport: () -> Unit,
    modifier: Modifier = Modifier,
    onBack: (() -> Unit)? = null,
) {
    if (loading && details == null) {
        Column(modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator()
            Text("Loading Space details")
        }
        return
    }
    val space = details ?: run {
        Column(modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            onBack?.let { TextButton(onClick = it) { Text("Back to Spaces") } }
            Text("Choose a Space", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text("Select a live or upcoming conversation to see its details.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }
    val summary = space.summary
    val host = space.viewerRole == SpaceRole.HOST || viewerId == summary.host.id
    val signedIn = !accessToken.isNullOrBlank()
    val joined = space.viewerJoined == true || space.viewerRole in setOf(SpaceRole.HOST, SpaceRole.MODERATOR, SpaceRole.SPEAKER)
    val live = summary.state == SpaceState.LIVE

    LazyColumn(modifier.fillMaxSize().padding(horizontal = 18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                onBack?.let { TextButton(onClick = it) { Text("Back to Spaces") } }
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(if (live) "LIVE SPACE" else summary.state.name.lowercase().replaceFirstChar(Char::uppercase), style = MaterialTheme.typography.labelLarge, color = if (live) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
                    Text("${summary.listenerCount} listening", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(summary.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text("Hosted by ${summary.host.name ?: summary.host.username?.let { "@$it" } ?: "Nantty member"}", style = MaterialTheme.typography.bodyMedium)
                summary.description?.let { Text(it, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                summary.scheduledAt?.takeIf { summary.state == SpaceState.SCHEDULED }?.let {
                    Text("Starts ${formatSpaceTime(it)}", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Audio", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text("Joining and moderation are connected to Nantty. Live audio is not available in this Android build yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    when {
                        !signedIn -> Button(onClick = onSignInRequired, enabled = live) { Text(if (live) "Sign in to join" else "Sign in to join when live") }
                        host && summary.state == SpaceState.SCHEDULED -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = { onStart(summary.id) }, enabled = !working) { Text("Start Space") }
                            OutlinedButton(onClick = { onCancel(summary.id) }, enabled = !working) { Text("Cancel") }
                        }
                        host && live -> Button(onClick = { onEnd(summary.id) }, enabled = !working) { Text("End Space") }
                        live && joined -> {
                            Text("You joined as ${space.viewerRole?.wireValue ?: "listener"}. Audio remains unavailable until LiveKit is integrated.", style = MaterialTheme.typography.bodySmall)
                            OutlinedButton(onClick = { onLeave(summary.id) }, enabled = !working) { Text("Leave Space") }
                        }
                        live -> Button(onClick = { onJoin(summary.id) }, enabled = !working) { Text("Join Space") }
                        summary.state == SpaceState.SCHEDULED -> Text("This Space is scheduled. You can join after the host starts it.", style = MaterialTheme.typography.bodyMedium)
                    }
                    if (joined && !host && live) {
                        when (space.speakerRequestState?.lowercase()) {
                            "pending" -> Text("Your request to speak is pending.", style = MaterialTheme.typography.bodySmall)
                            "declined" -> OutlinedButton(onClick = { onRequestSpeaker(summary.id) }, enabled = !working) { Text("Request to speak again") }
                            else -> OutlinedButton(onClick = { onRequestSpeaker(summary.id) }, enabled = !working) { Text("Request to speak") }
                        }
                    }
                    if (space.giftsEnabled && live && !host) {
                        OutlinedButton(
                            onClick = { if (signedIn) onDonate() else onSignInRequired() },
                            enabled = !working,
                        ) { Text(if (signedIn) "Donate Coins" else "Sign in to donate Coins") }
                    }
                }
            }
        }
        if (host && (summary.state == SpaceState.SCHEDULED || live)) {
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("Host controls", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text("Coin support", fontWeight = FontWeight.SemiBold)
                                Text("Let listeners donate Nantty Coins to support you. No virtual gifts.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Switch(checked = space.giftsEnabled, onCheckedChange = { onToggleDonations(summary.id, it) }, enabled = !working)
                        }
                        OutlinedButton(onClick = onInvite, enabled = !working) { Text("Invite participant") }
                    }
                }
            }
        }
        if (host && space.pendingSpeakerRequests.isNotEmpty()) {
            item { Text("Requests to speak", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold) }
            items(space.pendingSpeakerRequests, key = { it.id }) { request ->
                Card(Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Column(Modifier.weight(1f)) {
                            Text(request.user.name ?: request.user.username?.let { "@$it" } ?: "Nantty member", fontWeight = FontWeight.SemiBold)
                            Text("Wants to join the conversation", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        TextButton(onClick = { onDecline(summary.id, request.id) }, enabled = !working) { Text("Decline") }
                        Button(onClick = { onApprove(summary.id, request.id) }, enabled = !working) { Text("Approve") }
                    }
                }
            }
        }
        if (host && space.speakers.isNotEmpty()) {
            item { Text("Speakers", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold) }
            items(space.speakers.filterNot { it.id == summary.host.id }, key = { it.id }) { speaker ->
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(speaker.name ?: speaker.username?.let { "@$it" } ?: "Nantty member", fontWeight = FontWeight.SemiBold)
                        Text(if (speaker.muted) "Muted" else "Speaker", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            TextButton(onClick = { onMute(summary.id, speaker.id, !speaker.muted) }, enabled = !working) { Text(if (speaker.muted) "Unmute" else "Mute") }
                            TextButton(onClick = { onDemote(summary.id, speaker.id) }, enabled = !working) { Text("Move to listener") }
                            TextButton(onClick = { onRemove(summary.id, speaker.id) }, enabled = !working) { Text("Remove") }
                        }
                    }
                }
            }
        }
        item {
            HorizontalDivider()
            if (!host) {
                TextButton(onClick = onReport, enabled = !working) {
                    Text(if (signedIn) "Report this Space" else "Sign in to report this Space")
                }
            }
        }
    }
}
