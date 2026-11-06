package com.nantty.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.MessagesInboxFolder

@Composable
internal fun MessagesInboxToolbar(
    folder: MessagesInboxFolder,
    folderMenuExpanded: Boolean,
    onFolderMenuExpandedChange: (Boolean) -> Unit,
    onSelectFolder: (MessagesInboxFolder) -> Unit,
    onOpenGroupInvitations: () -> Unit,
    onOpenChannelInvitations: () -> Unit,
    onManageChannelLinks: () -> Unit,
    onNewMessage: () -> Unit,
    newMessageDescription: String,
    onSearch: () -> Unit,
    searchDescription: String,
    onCreateChannel: () -> Unit,
    onOpenSettings: () -> Unit,
    onRefresh: () -> Unit,
    refreshing: Boolean,
) {
    Row(
        Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.weight(1f)) {
            TextButton(onClick = { onFolderMenuExpandedChange(true) }) {
                Text(folder.label, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            }
            DropdownMenu(expanded = folderMenuExpanded, onDismissRequest = { onFolderMenuExpandedChange(false) }) {
                MessagesInboxFolder.entries.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option.label) },
                        onClick = { onFolderMenuExpandedChange(false); onSelectFolder(option) },
                        modifier = Modifier.semantics { contentDescription = "${option.label} inbox folder" },
                    )
                }
            }
        }
        TextButton(onClick = onOpenGroupInvitations, modifier = Modifier.semantics { contentDescription = "Open group invitations" }) {
            Text("Invites")
        }
        ChannelInvitationToolbarActions(onOpenChannelInvitations, onManageChannelLinks)
        TextButton(onClick = onNewMessage, modifier = Modifier.semantics { contentDescription = newMessageDescription }) {
            Text(newMessageDescription)
        }
        IconButton(onClick = onSearch, modifier = Modifier.semantics { contentDescription = searchDescription }) {
            Icon(Icons.Default.Search, contentDescription = null)
        }
        IconButton(onClick = onCreateChannel, modifier = Modifier.semantics { contentDescription = "Create broadcast channel" }) {
            Icon(Icons.Default.Add, contentDescription = null)
        }
        IconButton(onClick = onOpenSettings, modifier = Modifier.semantics { contentDescription = "Chat settings" }) {
            Icon(Icons.Default.Settings, contentDescription = null)
        }
        IconButton(onClick = onRefresh, enabled = !refreshing, modifier = Modifier.semantics { contentDescription = "Refresh messages" }) {
            Icon(Icons.Default.Refresh, contentDescription = null)
        }
    }
}
