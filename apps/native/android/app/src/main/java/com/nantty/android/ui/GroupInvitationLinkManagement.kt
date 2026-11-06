package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.nantty.android.data.GroupInvitationLinkPage
import com.nantty.android.data.GroupInvitationResult
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.listGroupInvitationLinks
import com.nantty.android.data.revokeGroupInvitationLink
import java.util.concurrent.Executor

@Composable
internal fun GroupInvitationLinksManager(
    conversationId: String,
    repository: MessagesRepository,
    executor: Executor,
    onReauthenticate: () -> Unit,
    refreshGeneration: Int,
) {
    var page by remember(conversationId, repository) { mutableStateOf<GroupInvitationLinkPage?>(null) }
    var loading by remember(conversationId, repository) { mutableStateOf(false) }
    var loadingMore by remember(conversationId, repository) { mutableStateOf(false) }
    var error by remember(conversationId, repository) { mutableStateOf<String?>(null) }
    var actionId by remember(conversationId, repository) { mutableStateOf<String?>(null) }
    var generation by remember(conversationId, repository) { mutableIntStateOf(0) }
    var reload by remember(conversationId, repository) { mutableIntStateOf(0) }

    LaunchedEffect(conversationId, repository, refreshGeneration, reload) {
        val request = ++generation
        loading = true
        error = null
        executor.execute {
            val result = repository.listGroupInvitationLinks(conversationId)
            Snapshot.withMutableSnapshot {
                if (request != generation) return@withMutableSnapshot
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

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("Invitation links · admins", style = MaterialTheme.typography.labelLarge)
        if (loading && page == null) CircularProgressIndicator()
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        if (!loading && page?.links.isNullOrEmpty() && error == null) {
            Text("No invitation links yet.", style = MaterialTheme.typography.bodySmall)
        }
        LazyColumn(Modifier.heightIn(max = 160.dp)) {
            items(page?.links.orEmpty(), key = { it.id }) { link ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(Modifier.weight(1f)) {
                        Text(if (link.revokedAt == null) "Active link" else "Revoked link", style = MaterialTheme.typography.bodySmall)
                        Text("Expires ${link.expiresAt}", style = MaterialTheme.typography.labelSmall)
                    }
                    if (link.revokedAt == null) {
                        TextButton(
                            onClick = {
                                if (actionId != null) return@TextButton
                                actionId = link.id
                                executor.execute {
                                    val result = repository.revokeGroupInvitationLink(conversationId, link.id)
                                    Snapshot.withMutableSnapshot {
                                        actionId = null
                                        when (result) {
                                            is GroupInvitationResult.Success -> reload++
                                            is GroupInvitationResult.Failure -> {
                                                error = result.message
                                                if (result.authenticationRequired) onReauthenticate()
                                            }
                                        }
                                    }
                                }
                            },
                            enabled = actionId == null,
                        ) { Text(if (actionId == link.id) "Revoking…" else "Revoke") }
                    }
                }
            }
        }
        page?.nextCursor?.let { cursor ->
            TextButton(
                onClick = {
                    if (loadingMore) return@TextButton
                    loadingMore = true
                    executor.execute {
                        val result = repository.listGroupInvitationLinks(conversationId, cursor)
                        Snapshot.withMutableSnapshot {
                            loadingMore = false
                            when (result) {
                                is GroupInvitationResult.Success -> {
                                    val current = page ?: GroupInvitationLinkPage(emptyList(), null)
                                    page = GroupInvitationLinkPage(
                                        (current.links + result.value.links).distinctBy { it.id },
                                        result.value.nextCursor,
                                    )
                                }
                                is GroupInvitationResult.Failure -> {
                                    error = result.message
                                    if (result.authenticationRequired) onReauthenticate()
                                }
                            }
                        }
                    }
                },
                enabled = !loadingMore,
            ) { Text(if (loadingMore) "Loading…" else "Load more links") }
        }
    }
}
