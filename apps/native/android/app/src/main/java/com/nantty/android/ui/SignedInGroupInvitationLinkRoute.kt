package com.nantty.android.ui

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.BuildConfig
import com.nantty.android.GroupInvitationDeepLink
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.GroupInvitationResult
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.createGroupInvitationLink
import com.nantty.android.data.claimGroupInvitationLink
import com.nantty.android.data.previewGroupInvitationLink
import java.util.concurrent.Executor

@Composable
internal fun rememberGroupInvitationLinkRoute(
    requestedToken: String?,
    onHandled: () -> Unit,
    onOpenMessages: () -> Unit,
) = rememberSaveable { mutableStateOf<String?>(null) }.also { pending ->
    LaunchedEffect(requestedToken) {
        if (requestedToken != null) {
            pending.value = requestedToken
            onOpenMessages()
            onHandled()
        }
    }
}

@Composable
internal fun GroupInvitationLinkRoute(
    token: String?,
    repository: MessagesRepository,
    executor: Executor,
    onHandled: () -> Unit,
    onOpenInvitations: () -> Unit,
    onReauthenticate: () -> Unit,
) {
    if (token == null) return
    GroupInvitationLinkPreviewDialog(
        token = token,
        repository = repository,
        executor = executor,
        onDismiss = onHandled,
        onOpenInvitations = {
            onHandled()
            onOpenInvitations()
        },
        onReauthenticate = onReauthenticate,
    )
}

@Composable
private fun GroupInvitationLinkPreviewDialog(
    token: String,
    repository: MessagesRepository,
    executor: Executor,
    onDismiss: () -> Unit,
    onOpenInvitations: () -> Unit,
    onReauthenticate: () -> Unit,
) {
    var loading by remember(token, repository) { mutableStateOf(true) }
    var preview by remember(token, repository) { mutableStateOf<com.nantty.android.data.GroupInvitationLinkPreview?>(null) }
    var error by remember(token, repository) { mutableStateOf<String?>(null) }
    var claiming by remember(token, repository) { mutableStateOf(false) }
    var claimed by remember(token, repository) { mutableStateOf(false) }

    LaunchedEffect(token, repository) {
        loading = true
        executor.execute {
            val result = repository.previewGroupInvitationLink(token)
            Snapshot.withMutableSnapshot {
                loading = false
                when (result) {
                    is GroupInvitationResult.Success -> preview = result.value
                    is GroupInvitationResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
            }
        }
    }

    fun claim() {
        if (claiming || claimed) return
        claiming = true
        error = null
        executor.execute {
            val result = repository.claimGroupInvitationLink(token)
            Snapshot.withMutableSnapshot {
                claiming = false
                when (result) {
                    is GroupInvitationResult.Success -> {
                        claimed = true
                        onOpenInvitations()
                    }
                    is GroupInvitationResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Group invitation") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                when {
                    loading -> CircularProgressIndicator()
                    preview != null -> {
                        Text(
                            preview?.title?.takeIf(String::isNotBlank) ?: "Nantty group",
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text("${preview?.memberCount ?: 0} members", style = MaterialTheme.typography.bodySmall)
                        Text(
                            "Requesting creates a pending invitation. You must accept it from Group invitations. Acceptance is consent only; secure key handoff is still required before any group access or history.",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
                if (claimed) Text("Request sent. Review it in Group invitations and accept if you want to continue.")
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(
                onClick = if (claimed) onOpenInvitations else ::claim,
                enabled = !loading && preview != null && !claiming,
            ) {
                Text(if (claiming) "Sending…" else if (claimed) "View invitations" else "Request invitation")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Close") } },
    )
}

@Composable
internal fun GroupInvitationLinkShareAction(
    conversation: InboxConversation,
    repository: MessagesRepository,
    executor: Executor,
    onReauthenticate: () -> Unit,
    enabled: Boolean = true,
    onCreated: () -> Unit = {},
) {
    val context = LocalContext.current
    var creating by remember(conversation.id, repository) { mutableStateOf(false) }
    var expiryHours by remember(conversation.id, repository) { mutableIntStateOf(DEFAULT_INVITATION_LINK_EXPIRY_HOURS) }
    var url by remember(conversation.id, repository) { mutableStateOf<String?>(null) }
    var error by remember(conversation.id, repository) { mutableStateOf<String?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        InvitationLinkExpiryPicker("Group", expiryHours, enabled && !creating) { expiryHours = it }
        TextButton(
            onClick = {
                if (creating || !enabled) return@TextButton
                creating = true
                error = null
                executor.execute {
                    val result = repository.createGroupInvitationLink(conversation.id, expiryHours)
                    Snapshot.withMutableSnapshot {
                        creating = false
                        when (result) {
                            is GroupInvitationResult.Failure -> {
                                error = result.message
                                if (result.authenticationRequired) onReauthenticate()
                            }
                            is GroupInvitationResult.Success -> {
                                onCreated()
                                url = GroupInvitationDeepLink.shareUrl(BuildConfig.NANTTY_WEBAPP_URL, result.value.token)
                                if (url == null) {
                                    error = "A secure sharing link could not be created on this app configuration."
                                } else {
                                    val shareIntent = Intent(Intent.ACTION_SEND).apply {
                                        type = "text/plain"
                                        putExtra(Intent.EXTRA_TEXT, url)
                                    }
                                    runCatching {
                                        context.startActivity(Intent.createChooser(shareIntent, "Share group invitation"))
                                    }.onFailure { error = "Link created. Copy it below to share." }
                                }
                            }
                        }
                    }
                }
            },
            enabled = enabled && !creating,
        ) { Text(if (creating) "Creating link…" else "Create and share invite link") }
        url?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
    }
}
