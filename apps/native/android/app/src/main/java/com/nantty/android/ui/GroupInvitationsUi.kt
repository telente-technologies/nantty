package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.ChatSearchPerson
import com.nantty.android.data.ChatSearchResult
import com.nantty.android.data.GroupInvitation
import com.nantty.android.data.GroupInvitationDirection
import com.nantty.android.data.GroupInvitationMembershipStatus
import com.nantty.android.data.GroupInvitationPage
import com.nantty.android.data.GroupInvitationResult
import com.nantty.android.data.GroupInvitationStatus
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesHttpException
import com.nantty.android.data.MessagesRepository
import com.nantty.android.GroupInvitationDeepLink
import java.util.concurrent.Executor

@Composable
internal fun GroupInvitationsDialog(
    repository: MessagesRepository,
    executor: Executor,
    onDismiss: () -> Unit,
    onReauthenticate: () -> Unit,
) {
    var direction by remember(repository) { mutableStateOf(GroupInvitationDirection.RECEIVED) }
    var page by remember(repository) { mutableStateOf<GroupInvitationPage?>(null) }
    var loading by remember(repository) { mutableStateOf(false) }
    var loadingMore by remember(repository) { mutableStateOf(false) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var actionError by remember(repository) { mutableStateOf<String?>(null) }
    var actionMessage by remember(repository) { mutableStateOf<String?>(null) }
    var pendingId by remember(repository) { mutableStateOf<String?>(null) }
    var generation by remember(repository) { mutableIntStateOf(0) }
    var refreshVersion by remember(repository) { mutableIntStateOf(0) }

    LaunchedEffect(repository, direction, refreshVersion) {
        val requestGeneration = generation + 1
        generation = requestGeneration
        loading = true
        error = null
        page = null
        executor.execute {
            val result = repository.listGroupInvitations(direction)
            Snapshot.withMutableSnapshot {
                if (requestGeneration != generation) return@withMutableSnapshot
                loading = false
                when (result) {
                    is GroupInvitationResult.Success -> page = result.value
                    is GroupInvitationResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
            }
        }
    }

    fun runAction(invitation: GroupInvitation, action: String) {
        if (pendingId != null) return
        pendingId = invitation.id
        actionError = null
        actionMessage = null
        executor.execute {
            val result = when (action) {
                "accept" -> repository.acceptGroupInvitation(invitation.id)
                "decline" -> repository.declineGroupInvitation(invitation.id)
                else -> repository.revokeGroupInvitation(invitation.conversationId, invitation.id)
            }
            Snapshot.withMutableSnapshot {
                pendingId = null
                when (result) {
                    is GroupInvitationResult.Failure -> {
                        actionError = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                    is GroupInvitationResult.Success -> {
                        val updated = result.value
                        val current = page ?: GroupInvitationPage(emptyList(), null)
                        page = when (updated.status) {
                            GroupInvitationStatus.ACCEPTED -> current.copy(invitations = current.invitations.map { if (it.id == updated.id) updated else it })
                            else -> current.copy(invitations = current.invitations.filterNot { it.id == updated.id })
                        }
                        actionMessage = if (action == "accept") {
                            "Consent recorded. You are not a group member yet; secure key handoff is still required. Group history remains unavailable."
                        } else "Invitation ${if (action == "decline") "declined" else "revoked"}."
                    }
                }
            }
        }
    }

    fun loadMore() {
        val cursor = page?.nextCursor ?: return
        if (loadingMore) return
        val requestGeneration = generation
        loadingMore = true
        actionError = null
        executor.execute {
            val result = repository.listGroupInvitations(direction, cursor)
            Snapshot.withMutableSnapshot {
                if (requestGeneration != generation) return@withMutableSnapshot
                loadingMore = false
                when (result) {
                    is GroupInvitationResult.Failure -> {
                        actionError = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                    is GroupInvitationResult.Success -> {
                        val current = page ?: GroupInvitationPage(emptyList(), null)
                        page = GroupInvitationPage(
                            (current.invitations + result.value.invitations).distinctBy(GroupInvitation::id),
                            result.value.nextCursor,
                        )
                    }
                }
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Group invitations", Modifier.semantics { contentDescription = "Group invitations" }) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GroupInvitationDirection.entries.forEach { option ->
                        if (direction == option) TextButton(onClick = {}, enabled = false) { Text(option.label) }
                        else TextButton(onClick = { direction = option; actionError = null; actionMessage = null }) { Text(option.label) }
                    }
                }
                HorizontalDivider()
                if (actionMessage != null) Text(actionMessage.orEmpty(), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall)
                if (actionError != null) Text(actionError.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                when {
                    loading -> Row(Modifier.fillMaxWidth().padding(20.dp), horizontalArrangement = Arrangement.Center) { CircularProgressIndicator() }
                    error != null -> Column {
                        Text(error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                        TextButton(onClick = { refreshVersion++ }) { Text("Try again") }
                    }
                    page?.invitations.isNullOrEmpty() -> Text(
                        if (direction == GroupInvitationDirection.RECEIVED) "No group invitations received." else "No pending group invitations sent.",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    else -> LazyColumn(Modifier.fillMaxWidth().heightIn(max = 360.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(page?.invitations.orEmpty(), key = GroupInvitation::id) { invitation ->
                            GroupInvitationRow(
                                invitation = invitation,
                                direction = direction,
                                busy = pendingId == invitation.id,
                                actionsEnabled = pendingId == null,
                                onAccept = { runAction(invitation, "accept") },
                                onDecline = { runAction(invitation, "decline") },
                                onRevoke = { runAction(invitation, "revoke") },
                            )
                            HorizontalDivider()
                        }
                        page?.nextCursor?.let {
                            item {
                                TextButton(onClick = ::loadMore, enabled = !loadingMore, modifier = Modifier.fillMaxWidth()) {
                                    if (loadingMore) CircularProgressIndicator() else Text("Load more")
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Done") } },
    )
}

@Composable
private fun GroupInvitationRow(
    invitation: GroupInvitation,
    direction: GroupInvitationDirection,
    busy: Boolean,
    actionsEnabled: Boolean,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onRevoke: () -> Unit,
) {
    val counterpart = invitation.counterpart
    val statusText = when {
        invitation.membershipStatus == GroupInvitationMembershipStatus.AWAITING_SECURE_KEY_HANDOFF ->
            "Accepted · secure key handoff pending. You have not joined this group."
        invitation.status == GroupInvitationStatus.PENDING && direction == GroupInvitationDirection.RECEIVED ->
            "Invited you to a group. Accepting records consent; it does not grant group access."
        else -> "Pending invitation · expires ${invitation.expiresAt.ifBlank { "soon" }}"
    }
    Column(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(counterpart?.name ?: "Nantty member", fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.titleSmall)
        counterpart?.username?.takeIf(String::isNotBlank)?.let { Text("@$it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        Text(
            statusText,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            when {
                invitation.status == GroupInvitationStatus.PENDING && direction == GroupInvitationDirection.RECEIVED -> {
                    OutlinedButton(onClick = onAccept, enabled = actionsEnabled) { Text(if (busy) "Working…" else "Accept") }
                    TextButton(onClick = onDecline, enabled = actionsEnabled) { Text("Decline") }
                }
                invitation.status == GroupInvitationStatus.PENDING && direction == GroupInvitationDirection.SENT ->
                    TextButton(onClick = onRevoke, enabled = actionsEnabled) { Text(if (busy) "Working…" else "Revoke") }
            }
        }
    }
}

@Composable
internal fun InviteGroupMemberDialog(
    conversation: InboxConversation,
    repository: MessagesRepository,
    executor: Executor,
    onDismiss: () -> Unit,
    onReauthenticate: () -> Unit,
    onInvitationSent: () -> Unit,
) {
    var query by remember(repository, conversation.id) { mutableStateOf("") }
    var people by remember(repository, conversation.id) { mutableStateOf<List<ChatSearchPerson>>(emptyList()) }
    var selected by remember(repository, conversation.id) { mutableStateOf<Map<String, ChatSearchPerson>>(emptyMap()) }
    var searching by remember(repository, conversation.id) { mutableStateOf(false) }
    var sending by remember(repository, conversation.id) { mutableStateOf(false) }
    var error by remember(repository, conversation.id) { mutableStateOf<String?>(null) }
    var sentMessage by remember(repository, conversation.id) { mutableStateOf<String?>(null) }
    var linkRefreshGeneration by remember(repository, conversation.id) { mutableIntStateOf(0) }
    var generation by remember(repository, conversation.id) { mutableIntStateOf(0) }

    LaunchedEffect(repository, query) {
        generation += 1
        val requestGeneration = generation
        val term = query.trim()
        error = null
        if (term.isEmpty()) {
            people = emptyList()
            searching = false
        } else {
            searching = true
            executor.execute {
                val outcome = repository.search(term)
                Snapshot.withMutableSnapshot {
                    if (requestGeneration != generation) return@withMutableSnapshot
                    searching = false
                    when (outcome) {
                        is ChatSearchResult.Success -> people = outcome.results.people
                        is ChatSearchResult.Failure -> {
                            error = outcome.message
                            if (outcome.authenticationRequired) onReauthenticate()
                        }
                    }
                }
            }
        }
    }

    fun sendInvitations() {
        val invitees = selected.values.toList()
        if (invitees.isEmpty()) return
        if (sending) return
        sending = true
        error = null
        sentMessage = null
        executor.execute {
            val sent = mutableListOf<ChatSearchPerson>()
            val failed = mutableListOf<Pair<ChatSearchPerson, GroupInvitationResult.Failure>>()
            invitees.forEach { person ->
                when (val outcome = repository.createGroupInvitation(conversation.id, person.id)) {
                    is GroupInvitationResult.Success -> sent += person
                    is GroupInvitationResult.Failure -> failed += person to outcome
                }
            }
            Snapshot.withMutableSnapshot {
                sending = false
                selected = failed.associate { (person, _) -> person.id to person }
                if (sent.isNotEmpty()) {
                    sentMessage = "${sent.size} invitation${if (sent.size == 1) "" else "s"} sent. Each person must accept before consent is recorded; secure key handoff is still required before group access."
                    onInvitationSent()
                }
                if (failed.isNotEmpty()) {
                    error = if (sent.isEmpty()) failed.first().second.message
                    else "${failed.size} invitation${if (failed.size == 1) "" else "s"} couldn't be sent. The remaining people are still selected so you can retry."
                    if (failed.any { it.second.authenticationRequired }) onReauthenticate()
                }
            }
        }
    }

    AlertDialog(
        onDismissRequest = { if (!sending) onDismiss() },
        title = { Text("Invite to ${conversation.title}", maxLines = 1) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Search for a Nantty member. They must accept the invitation; acceptance alone does not add them or expose group history.", style = MaterialTheme.typography.bodySmall)
                GroupInvitationLinkShareAction(conversation, repository, executor, onReauthenticate, enabled = !sending) { linkRefreshGeneration++ }
                GroupInvitationLinksManager(conversation.id, repository, executor, onReauthenticate, linkRefreshGeneration)
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it; sentMessage = null },
                    label = { Text("Search by name or username") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (searching) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) { CircularProgressIndicator() }
                if (error != null) Text(error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                if (sentMessage != null) Text(sentMessage.orEmpty(), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall)
                if (!searching && query.isNotBlank() && people.isEmpty() && error == null) Text("No matching members found.", style = MaterialTheme.typography.bodySmall)
                LazyColumn(Modifier.heightIn(max = 220.dp)) {
                    items(people, key = ChatSearchPerson::id) { person ->
                        val isSelected = selected.containsKey(person.id)
                        TextButton(
                            onClick = {
                                selected = if (isSelected) selected - person.id else selected + (person.id to person)
                                sentMessage = null
                                error = null
                            },
                            enabled = !sending,
                            modifier = Modifier.fillMaxWidth().semantics {
                                contentDescription = "${if (isSelected) "Remove" else "Select"} ${person.name}${person.username?.let { ", @$it" }.orEmpty()}"
                            },
                        ) {
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Surface(Modifier.size(40.dp), shape = CircleShape, color = MaterialTheme.colorScheme.secondaryContainer) {
                                    Box(contentAlignment = Alignment.Center) {
                                        person.avatarUrl?.let { avatar ->
                                            AsyncImage(
                                                model = avatar,
                                                contentDescription = null,
                                                modifier = Modifier.fillMaxSize().clip(CircleShape),
                                                contentScale = ContentScale.Crop,
                                            )
                                        } ?: Text(person.name.take(1).uppercase(), color = MaterialTheme.colorScheme.onSecondaryContainer)
                                    }
                                }
                                Column(Modifier.weight(1f)) {
                                    Text(person.name, fontWeight = FontWeight.SemiBold)
                                    person.username?.takeIf(String::isNotBlank)?.let { Text("@$it", style = MaterialTheme.typography.bodySmall) }
                                }
                                Text(if (isSelected) "Selected" else "Select", color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                            }
                        }
                    }
                }
                if (selected.isNotEmpty()) Text("${selected.size} selected", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        confirmButton = {
            TextButton(onClick = ::sendInvitations, enabled = selected.isNotEmpty() && !sending) {
                Text(if (sending) "Sending…" else "Send ${selected.size.coerceAtLeast(1)} invitation${if (selected.size == 1) "" else "s"}")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !sending) { Text("Close") } },
    )
}

