package com.nantty.android.ui.spaces

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.SpaceInvitation
import com.nantty.android.data.SpaceState
import com.nantty.android.data.SpaceSummary

@Composable
internal fun SpacesListPane(
    items: List<SpaceSummary>,
    selectedId: String?,
    loading: Boolean,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    invitations: List<SpaceInvitation> = emptyList(),
    invitationsVisible: Boolean = false,
    invitationsLoading: Boolean = false,
    invitationsError: String? = null,
    invitationActionError: String? = null,
    respondingInvitationId: String? = null,
    invitationNextCursor: String? = null,
    onOpenInvitation: (SpaceInvitation) -> Unit = {},
    onRespondInvitation: (SpaceInvitation, Boolean) -> Unit = { _, _ -> },
    onRetryInvitations: () -> Unit = {},
    onLoadMoreInvitations: () -> Unit = {},
) {
    LazyColumn(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (invitationsVisible) {
            item(key = "invitations-heading") {
                Column(Modifier.fillMaxWidth().padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Your invitations", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text("Invitations sent to your account", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            if (invitationsLoading && invitations.isEmpty()) {
                item(key = "invitations-loading") {
                    Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        CircularProgressIndicator()
                        Text("Loading invitations", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            invitationsError?.let { message ->
                item(key = "invitations-error") {
                    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
                        TextButton(onClick = onRetryInvitations, enabled = !invitationsLoading) { Text("Retry invitations") }
                    }
                }
            }
            if (!invitationsLoading && invitationsError == null && invitations.isEmpty()) {
                item(key = "invitations-empty") {
                    Text("No pending Space invitations", Modifier.fillMaxWidth().padding(vertical = 8.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            invitationActionError?.let { message ->
                item(key = "invitation-action-error") {
                    Text(message, Modifier.fillMaxWidth().padding(vertical = 4.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
                }
            }
            items(invitations, key = { "invitation:${it.spaceId}:${it.invitationId}" }) { invitation ->
                SpaceInvitationCard(
                    invitation = invitation,
                    responding = respondingInvitationId == invitation.invitationId,
                    anyResponseInFlight = respondingInvitationId != null,
                    onOpen = { onOpenInvitation(invitation) },
                    onAccept = { onRespondInvitation(invitation, true) },
                    onDecline = { onRespondInvitation(invitation, false) },
                )
            }
            if (invitationNextCursor != null) {
                item(key = "invitations-load-more") {
                    TextButton(onClick = onLoadMoreInvitations, enabled = !invitationsLoading) {
                        if (invitationsLoading) CircularProgressIndicator()
                        else Text("Load more invitations")
                    }
                }
            }
        }
        when {
            loading && items.isEmpty() -> item(key = "spaces-loading") {
                Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    CircularProgressIndicator()
                    Text("Loading Spaces", style = MaterialTheme.typography.bodyMedium)
                }
            }
            items.isEmpty() -> item(key = "spaces-empty") {
                Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("No live or upcoming Spaces", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text("When a host goes live or schedules a Space, it will appear here.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            else -> items(items, key = { "space:${it.id}" }) { space ->
                val status = if (space.state == SpaceState.LIVE) "LIVE" else "UPCOMING"
                Card(
                    Modifier.fillMaxWidth()
                        .semantics { selected = selectedId == space.id }
                        .clickable { onSelect(space.id) },
                ) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(status, style = MaterialTheme.typography.labelMedium, color = if (space.state == SpaceState.LIVE) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
                            Text("${space.listenerCount} listening", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text(space.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text("Hosted by ${space.host.name ?: space.host.username?.let { "@$it" } ?: "Nantty member"}", style = MaterialTheme.typography.bodySmall)
                        space.description?.let { Text(it, maxLines = 2, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        if (space.state == SpaceState.SCHEDULED && space.scheduledAt != null) {
                            Text("Scheduled ${formatSpaceTime(space.scheduledAt)}", style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SpaceInvitationCard(
    invitation: SpaceInvitation,
    responding: Boolean,
    anyResponseInFlight: Boolean,
    onOpen: () -> Unit,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    val roleLabel = spaceInvitationRoleLabel(invitation.role)
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = onOpen, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text("Invited by ${invitation.space.host.name ?: invitation.space.host.username?.let { "@$it" } ?: "Nantty member"}", style = MaterialTheme.typography.labelLarge)
                    Text(invitation.space.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text(buildString {
                        append(roleLabel)
                        invitation.title?.let { append(" · "); append(it) }
                        append(" · ")
                        append(formatSpaceTime(invitation.invitedAt))
                    }, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    invitation.space.description?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    Text("Open Space details", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onAccept, enabled = !anyResponseInFlight, modifier = Modifier.weight(1f)) {
                    if (responding) CircularProgressIndicator()
                    else Text("Accept")
                }
                OutlinedButton(onClick = onDecline, enabled = !anyResponseInFlight, modifier = Modifier.weight(1f)) {
                    Text(if (responding) "Please wait" else "Decline")
                }
            }
        }
    }
}

internal fun formatSpaceTime(value: String): String = runCatching {
    java.time.Instant.parse(value).atZone(java.time.ZoneId.systemDefault())
        .format(java.time.format.DateTimeFormatter.ofPattern("EEE, d MMM · h:mm a"))
}.getOrDefault(value)
