package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesRepository
import java.util.concurrent.Executor

@Composable
internal fun ChannelInvitationToolbarActions(onOpenInvitations: () -> Unit, onManageLinks: () -> Unit) {
    Row {
        TextButton(onClick = onOpenInvitations, modifier = androidx.compose.ui.Modifier.semantics { contentDescription = "Open channel invitations" }) { Text("Channel invites") }
        TextButton(onClick = onManageLinks, modifier = androidx.compose.ui.Modifier.semantics { contentDescription = "Manage channel invitation links" }) { Text("Channel links") }
    }
}

@Composable
internal fun ChannelInvitationOverlays(
    showInvitations: Boolean,
    showLinks: Boolean,
    channels: List<InboxConversation>,
    token: String?,
    repository: MessagesRepository,
    executor: Executor,
    onInvitationsVisibilityChange: (Boolean) -> Unit,
    onLinksVisibilityChange: (Boolean) -> Unit,
    onTokenHandled: () -> Unit,
    onReauthenticate: () -> Unit,
) {
    if (showInvitations) {
        ChannelInvitationsDialog(repository, executor, { onInvitationsVisibilityChange(false) }, onReauthenticate)
    }
    if (showLinks) {
        ChannelInvitationLinksDialog(channels, repository, executor, { onLinksVisibilityChange(false) }, onReauthenticate)
    }
    ChannelInvitationLinkRoute(token, repository, executor, onTokenHandled, { onInvitationsVisibilityChange(true) }, onReauthenticate)
}
