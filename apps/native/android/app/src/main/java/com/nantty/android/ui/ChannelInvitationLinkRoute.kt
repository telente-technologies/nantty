package com.nantty.android.ui

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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.ChannelInvitationLinkPreview
import com.nantty.android.data.ChannelInvitationResult
import com.nantty.android.data.MessagesRepository
import java.util.concurrent.Executor

@Composable
internal fun ChannelInvitationLinkRoute(
    token: String?,
    repository: MessagesRepository,
    executor: Executor,
    onHandled: () -> Unit,
    onOpenInvitations: () -> Unit,
    onReauthenticate: () -> Unit,
) {
    if (token == null) return
    var loading by remember(token, repository) { mutableStateOf(true) }
    var preview by remember(token, repository) { mutableStateOf<ChannelInvitationLinkPreview?>(null) }
    var error by remember(token, repository) { mutableStateOf<String?>(null) }
    var claiming by remember(token, repository) { mutableStateOf(false) }
    var claimed by remember(token, repository) { mutableStateOf(false) }

    LaunchedEffect(token, repository) {
        loading = true
        executor.execute {
            val result = repository.channelInvitationsRepository.previewLink(token)
            Snapshot.withMutableSnapshot {
                loading = false
                when (result) {
                    is ChannelInvitationResult.Success -> preview = result.value
                    is ChannelInvitationResult.Failure -> {
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
            val result = repository.channelInvitationsRepository.claimLink(token)
            Snapshot.withMutableSnapshot {
                claiming = false
                when (result) {
                    is ChannelInvitationResult.Success -> {
                        claimed = true
                        onHandled()
                        onOpenInvitations()
                    }
                    is ChannelInvitationResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onReauthenticate()
                    }
                }
            }
        }
    }

    AlertDialog(
        onDismissRequest = onHandled,
        title = { Text("Channel invitation") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                when {
                    loading -> CircularProgressIndicator()
                    preview != null -> {
                        Text(preview?.title?.takeIf(String::isNotBlank) ?: "Nantty channel", fontWeight = FontWeight.SemiBold)
                        Text("${preview?.subscriberCount ?: 0} subscribers", style = MaterialTheme.typography.bodySmall)
                        Text("Requesting an invite does not subscribe you. The invitation remains pending until you explicitly accept it.", style = MaterialTheme.typography.bodySmall)
                    }
                }
                if (claimed) Text("Request sent. Accept the pending invitation to subscribe to this channel.")
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(onClick = if (claimed) onOpenInvitations else ::claim, enabled = !loading && preview != null && !claiming) {
                Text(if (claiming) "Sending…" else if (claimed) "View invitations" else "Request invitation")
            }
        },
        dismissButton = { TextButton(onClick = onHandled) { Text("Close") } },
    )
}
