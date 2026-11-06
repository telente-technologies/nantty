package com.nantty.android.ui

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.nantty.android.BuildConfig
import com.nantty.android.ChannelInvitationDeepLink
import com.nantty.android.data.ChannelInvitation
import com.nantty.android.data.ChannelInvitationLinkPage
import com.nantty.android.data.ChannelInvitationPage
import com.nantty.android.data.ChannelInvitationResult
import com.nantty.android.data.ConversationType
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesRepository
import java.util.concurrent.Executor

@Composable
internal fun ChannelInvitationLinksDialog(
    channels: List<InboxConversation>,
    repository: MessagesRepository,
    executor: Executor,
    onDismiss: () -> Unit,
    onReauthenticate: () -> Unit,
) {
    var channelId by remember(channels) { mutableStateOf(channels.firstOrNull()?.id) }
    var menuExpanded by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Channel invitation links") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (channels.isEmpty()) Text("No channels are available in this inbox yet.")
                else {
                    TextButton(onClick = { menuExpanded = true }, modifier = Modifier.semantics { contentDescription = "Select channel for invite links" }) {
                        Text(channels.firstOrNull { it.id == channelId }?.title ?: "Choose channel")
                    }
                    DropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }) {
                        channels.forEach { channel ->
                            DropdownMenuItem(text = { Text(channel.title) }, onClick = { channelId = channel.id; menuExpanded = false })
                        }
                    }
                    channelId?.let { id -> ChannelInvitationLinksManager(id, repository, executor, onReauthenticate) }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Done") } },
    )
}

@Composable
private fun ChannelInvitationLinksManager(
    channelId: String,
    repository: MessagesRepository,
    executor: Executor,
    onReauthenticate: () -> Unit,
) {
    val context = LocalContext.current
    var page by remember(channelId, repository) { mutableStateOf<ChannelInvitationLinkPage?>(null) }
    var loading by remember(channelId, repository) { mutableStateOf(false) }
    var busyId by remember(channelId, repository) { mutableStateOf<String?>(null) }
    var error by remember(channelId, repository) { mutableStateOf<String?>(null) }
    var shareText by remember(channelId, repository) { mutableStateOf<String?>(null) }
    var reload by remember(channelId, repository) { mutableIntStateOf(0) }

    LaunchedEffect(channelId, repository, reload) {
        loading = true
        error = null
        executor.execute {
            val result = repository.channelInvitationsRepository.listLinks(channelId)
            Snapshot.withMutableSnapshot {
                loading = false
                when (result) {
                    is ChannelInvitationResult.Success -> page = result.value
                    is ChannelInvitationResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
            }
        }
    }

    TextButton(
        onClick = {
            if (busyId != null) return@TextButton
            busyId = "create"
            error = null
            executor.execute {
                val result = repository.channelInvitationsRepository.createLink(channelId)
                Snapshot.withMutableSnapshot {
                    busyId = null
                    when (result) {
                        is ChannelInvitationResult.Failure -> {
                            error = result.message
                            if (result.authenticationRequired) onReauthenticate()
                        }
                        is ChannelInvitationResult.Success -> {
                            shareText = ChannelInvitationDeepLink.shareUrl(BuildConfig.NANTTY_WEBAPP_URL, result.value.token)
                            if (shareText == null) error = "A secure share link is unavailable for this app configuration."
                            else runCatching {
                                context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_TEXT, shareText)
                                }, "Share channel invitation"))
                            }.onFailure { error = "Link created. Copy it below to share." }
                            reload++
                        }
                    }
                }
            }
        },
        enabled = busyId == null,
        modifier = Modifier.semantics { contentDescription = "Create and share channel invitation link" },
    ) { Text(if (busyId == "create") "Creating…" else "Create invite link") }
    shareText?.let { Text(it, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(horizontal = 8.dp)) }
    if (loading && page == null) CircularProgressIndicator()
    error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
    if (!loading && page?.links.isNullOrEmpty() && error == null) Text("No invitation links yet.", style = MaterialTheme.typography.bodySmall)
    LazyColumn(Modifier.heightIn(max = 220.dp)) {
        items(page?.links.orEmpty(), key = { it.id }) { link ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(Modifier.weight(1f)) {
                    Text(if (link.revokedAt == null) "Active link" else "Revoked link", style = MaterialTheme.typography.bodySmall)
                    Text("Expires ${link.expiresAt}", style = MaterialTheme.typography.labelSmall)
                }
                if (link.revokedAt == null) TextButton(
                    onClick = {
                        busyId = link.id
                        executor.execute {
                            val result = repository.channelInvitationsRepository.revokeLink(channelId, link.id)
                            Snapshot.withMutableSnapshot {
                                busyId = null
                                when (result) {
                                    is ChannelInvitationResult.Success -> reload++
                                    is ChannelInvitationResult.Failure -> {
                                        error = result.message
                                        if (result.authenticationRequired) onReauthenticate()
                                    }
                                }
                            }
                        }
                    }, enabled = busyId == null,
                ) { Text(if (busyId == link.id) "Revoking…" else "Revoke") }
            }
        }
        page?.nextCursor?.let { cursor -> item {
            TextButton(onClick = {
                if (busyId != null) return@TextButton
                busyId = "more"
                executor.execute {
                    val result = repository.channelInvitationsRepository.listLinks(channelId, cursor)
                    Snapshot.withMutableSnapshot {
                        busyId = null
                        when (result) {
                            is ChannelInvitationResult.Success -> {
                                val current = page ?: ChannelInvitationLinkPage(emptyList(), null)
                                page = current.copy(links = (current.links + result.value.links).distinctBy { it.id }, nextCursor = result.value.nextCursor)
                            }
                            is ChannelInvitationResult.Failure -> {
                                error = result.message
                                if (result.authenticationRequired) onReauthenticate()
                            }
                        }
                    }
                }
            }, enabled = busyId == null) { Text(if (busyId == "more") "Loading…" else "Load more") }
        } }
    }
}

@Composable
internal fun ChannelInvitationsDialog(
    repository: MessagesRepository,
    executor: Executor,
    onDismiss: () -> Unit,
    onChannelAccepted: (ChannelInvitation) -> Unit,
    onReauthenticate: () -> Unit,
) {
    var page by remember(repository) { mutableStateOf<ChannelInvitationPage?>(null) }
    var loading by remember(repository) { mutableStateOf(false) }
    var busyId by remember(repository) { mutableStateOf<String?>(null) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var notice by remember(repository) { mutableStateOf<String?>(null) }
    var reload by remember(repository) { mutableIntStateOf(0) }

    LaunchedEffect(repository, reload) {
        loading = true
        executor.execute {
            val result = repository.channelInvitationsRepository.listPending()
            Snapshot.withMutableSnapshot {
                loading = false
                when (result) {
                    is ChannelInvitationResult.Success -> page = result.value
                    is ChannelInvitationResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Channel invitations") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("A link claim is only a request. Accepting an invitation subscribes you to the channel.", style = MaterialTheme.typography.bodySmall)
                if (loading && page == null) CircularProgressIndicator()
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                notice?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
                if (!loading && page?.invitations.isNullOrEmpty() && error == null) Text("No pending channel invitations.")
                LazyColumn(Modifier.heightIn(max = 260.dp)) {
                    items(page?.invitations.orEmpty(), key = ChannelInvitation::id) { invitation ->
                        ChannelInvitationConsentRow(invitation, busyId, onRespond = { action ->
                            if (busyId != null) return@ChannelInvitationConsentRow
                            busyId = invitation.id
                            error = null
                            executor.execute {
                                val result = if (action == "accept") repository.channelInvitationsRepository.accept(invitation.id)
                                else repository.channelInvitationsRepository.decline(invitation.id)
                                val acceptedInvitation = (result as? ChannelInvitationResult.Success)
                                    ?.value
                                    ?.takeIf { action == "accept" }
                                Snapshot.withMutableSnapshot {
                                    busyId = null
                                    when (result) {
                                        is ChannelInvitationResult.Success -> {
                                            val current = page ?: ChannelInvitationPage(emptyList(), null)
                                            page = current.copy(invitations = current.invitations.filterNot { it.id == invitation.id })
                                            notice = if (action == "accept") "Channel invitation accepted. You are now subscribed." else "Channel invitation declined."
                                        }
                                        is ChannelInvitationResult.Failure -> {
                                            error = result.message
                                            if (result.authenticationRequired) onReauthenticate()
                                        }
                                    }
                                }
                                acceptedInvitation?.let(onChannelAccepted)
                            }
                        })
                    }
                }
                page?.nextCursor?.let { cursor -> TextButton(onClick = {
                    executor.execute {
                        val result = repository.channelInvitationsRepository.listPending(cursor)
                        Snapshot.withMutableSnapshot {
                            when (result) {
                                is ChannelInvitationResult.Success -> {
                                    val current = page ?: ChannelInvitationPage(emptyList(), null)
                                    page = current.copy(invitations = (current.invitations + result.value.invitations).distinctBy(ChannelInvitation::id), nextCursor = result.value.nextCursor)
                                }
                                is ChannelInvitationResult.Failure -> {
                                    error = result.message
                                    if (result.authenticationRequired) onReauthenticate()
                                }
                            }
                        }
                    }
                }) { Text("Load more") } }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Done") } },
    )
}

@Composable
internal fun ChannelInvitationConsentRow(
    invitation: ChannelInvitation,
    busyId: String?,
    onRespond: (String) -> Unit,
) {
    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Text(invitation.channelTitle?.takeIf(String::isNotBlank) ?: "Nantty channel", style = MaterialTheme.typography.titleSmall)
        Text("Invitation expires ${invitation.expiresAt}", style = MaterialTheme.typography.bodySmall)
        Row {
            TextButton(onClick = { onRespond("accept") }, enabled = busyId == null, modifier = Modifier.semantics { contentDescription = "Accept channel invitation" }) {
                Text(if (busyId == invitation.id) "Updating…" else "Accept")
            }
            TextButton(onClick = { onRespond("decline") }, enabled = busyId == null, modifier = Modifier.semantics { contentDescription = "Decline channel invitation" }) { Text("Decline") }
        }
    }
}

internal fun availableChannelConversations(conversations: List<InboxConversation>): List<InboxConversation> =
    conversations.filter { it.type == ConversationType.CHANNEL }.distinctBy(InboxConversation::id)
