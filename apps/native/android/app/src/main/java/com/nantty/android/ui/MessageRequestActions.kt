package com.nantty.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesInboxFolder

@Composable
internal fun MessageRequestActions(
    conversation: InboxConversation,
    folder: MessagesInboxFolder,
    pendingActionConversationId: String?,
    actionError: String?,
    onAction: (String) -> Unit,
    onBlock: () -> Unit,
) {
    val actionInProgress = pendingActionConversationId != null
    Column(
        Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            if (folder == MessagesInboxFolder.SPAM) {
                conversation.spamReason ?: "Flagged by Nantty based on this account's activity."
            } else {
                "They won't see you've read this until you accept."
            },
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (actionError != null && !actionInProgress) {
            Text(actionError, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (folder == MessagesInboxFolder.REQUESTS) {
                OutlinedButton(onClick = { onAction("accept") }, enabled = !actionInProgress) {
                    Text(if (pendingActionConversationId == conversation.id) "Working…" else "Accept")
                }
            } else {
                OutlinedButton(onClick = { onAction("not-spam") }, enabled = !actionInProgress) {
                    Text(if (pendingActionConversationId == conversation.id) "Working…" else "Not spam")
                }
            }
            OutlinedButton(onClick = { onAction("delete") }, enabled = !actionInProgress) { Text("Delete") }
            OutlinedButton(onClick = onBlock, enabled = !actionInProgress) { Text("Block") }
        }
    }
}
