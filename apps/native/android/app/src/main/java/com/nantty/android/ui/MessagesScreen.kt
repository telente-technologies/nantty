package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.clickable
import androidx.activity.compose.BackHandler
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.R
import com.nantty.android.data.ConversationPage
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.MessagesFilter
import com.nantty.android.data.MessagesHttpException
import com.nantty.android.data.MessagesInboxFolder
import com.nantty.android.data.MessagesResult
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.Executor

@Composable
internal fun MessagesScreen(
    repository: MessagesRepository,
    executor: Executor,
    modifier: Modifier = Modifier,
    onReauthenticate: () -> Unit = {},
    initialConversation: InboxConversation? = null,
    onInitialConversationHandled: () -> Unit = {},
    onOpenConversation: (InboxConversation) -> Unit = {},
) {
    val searchActionDescription = stringResource(R.string.messages_search_action)
    var selectedConversation by remember(repository) { mutableStateOf<InboxConversation?>(null) }
    var result by remember(repository) { mutableStateOf<MessagesResult?>(null) }
    var filter by remember(repository) { mutableStateOf(MessagesFilter.ALL) }
    var folder by remember(repository) { mutableStateOf(MessagesInboxFolder.CHATS) }
    var folderMenuExpanded by remember(repository) { mutableStateOf(false) }
    var pendingBlockConversation by remember(repository) { mutableStateOf<InboxConversation?>(null) }
    var pendingActionConversationId by remember(repository) { mutableStateOf<String?>(null) }
    var inboxActionError by remember(repository) { mutableStateOf<String?>(null) }
    var refreshVersion by remember(repository) { mutableIntStateOf(0) }
    var requestGeneration by remember(repository) { mutableIntStateOf(0) }
    var loading by remember(repository) { mutableStateOf(false) }
    var loadingMore by remember(repository) { mutableStateOf(false) }
    var pageError by remember(repository) { mutableStateOf<String?>(null) }
    var searchMode by remember(repository) { mutableStateOf(false) }

    LaunchedEffect(repository, initialConversation?.id) {
        initialConversation?.let {
            selectedConversation = it
            searchMode = false
            onOpenConversation(it)
            onInitialConversationHandled()
        }
    }

    fun refresh() {
        requestGeneration += 1
        refreshVersion += 1
    }

    fun selectFilter(next: MessagesFilter) {
        if (filter == next) return
        // Invalidate in-flight list and pagination requests before the new effect starts.
        requestGeneration += 1
        filter = next
        result = null
        loading = true
        loadingMore = false
        pageError = null
    }

    fun selectFolder(next: MessagesInboxFolder) {
        if (folder == next) return
        requestGeneration += 1
        folder = next
        filter = MessagesFilter.ALL
        result = null
        loading = true
        loadingMore = false
        pageError = null
        inboxActionError = null
    }

    fun runInboxAction(conversation: InboxConversation, action: String) {
        if (pendingActionConversationId != null) return
        inboxActionError = null
        pendingActionConversationId = conversation.id
        executor.execute {
            val outcome = when (action) {
                "accept" -> repository.acceptMessageRequest(conversation.id)
                "not-spam" -> repository.markConversationNotSpam(conversation.id)
                "delete" -> repository.deleteMessageRequest(conversation.id)
                "block" -> repository.blockConversationPeer(conversation.id)
                else -> Result.failure(IllegalArgumentException("Unsupported message-request action."))
            }
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                pendingActionConversationId = null
                if (outcome.isSuccess) refresh() else {
                    val error = outcome.exceptionOrNull()
                    if (error is MessagesHttpException && error.statusCode in setOf(401, 403)) onReauthenticate()
                    else inboxActionError = error?.message ?: "Couldn't update this message request. Try again."
                }
            }
        }
    }

    fun loadMore() {
        val current = (result as? MessagesResult.Success)?.page ?: return
        val cursor = current.nextCursor ?: return
        if (loadingMore) return
        loadingMore = true
        pageError = null
        val requestFilter = filter
        val requestFolder = folder
        val generation = requestGeneration
        executor.execute {
            val loaded = repository.load(cursor = cursor, filter = requestFilter, folder = requestFolder)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (generation != requestGeneration || requestFilter != filter || requestFolder != folder) return@withMutableSnapshot
                when (loaded) {
                    is MessagesResult.Failure -> pageError = loaded.message
                    is MessagesResult.Success -> {
                        val latest = (result as? MessagesResult.Success)?.page ?: current
                        val merged = (latest.conversations + loaded.page.conversations).distinctBy(InboxConversation::id)
                        result = MessagesResult.Success(ConversationPage(merged, loaded.page.nextCursor))
                    }
                }
                loadingMore = false
            }
        }
    }

    LaunchedEffect(repository, filter, folder, refreshVersion) {
        val requestFilter = filter
        val requestFolder = folder
        val generation = requestGeneration + 1
        requestGeneration = generation
        loading = true
        loadingMore = false
        pageError = null
        result = null
        executor.execute {
            val loaded = repository.load(filter = requestFilter, folder = requestFolder)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (generation != requestGeneration || requestFilter != filter || requestFolder != folder) return@withMutableSnapshot
                result = loaded
                loading = false
            }
        }
    }

    BackHandler(enabled = selectedConversation != null || searchMode) {
        if (selectedConversation != null) selectedConversation = null else searchMode = false
    }
    selectedConversation?.let { conversation ->
        AndroidConversationScreen(
            conversation = conversation,
            repository = repository,
            executor = executor,
            onBack = { selectedConversation = null },
            onReauthenticate = onReauthenticate,
            onConversationRead = {
                androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    selectedConversation = selectedConversation?.copy(unreadCount = 0)
                    val success = result as? MessagesResult.Success
                    if (success != null) {
                        result = success.copy(page = success.page.copy(conversations = success.page.conversations.map {
                            if (it.id == conversation.id) it.copy(unreadCount = 0) else it
                        }))
                    }
                }
            },
        )
        return
    }

    if (searchMode) {
        MessagesSearchScreen(
            repository = repository,
            executor = executor,
            onBack = { searchMode = false },
            onReauthenticate = onReauthenticate,
            onOpenConversation = { conversation ->
                selectedConversation = conversation
                onOpenConversation(conversation)
            },
        )
        return
    }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.weight(1f)) {
                TextButton(onClick = { folderMenuExpanded = true }) {
                    Text(folder.label, Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                }
                DropdownMenu(expanded = folderMenuExpanded, onDismissRequest = { folderMenuExpanded = false }) {
                    MessagesInboxFolder.entries.forEach { option ->
                        DropdownMenuItem(
                            text = { Text(option.label) },
                            onClick = { folderMenuExpanded = false; selectFolder(option) },
                            modifier = Modifier.semantics { contentDescription = "${option.label} inbox folder" },
                        )
                    }
                }
            }
            IconButton(onClick = { searchMode = true }, modifier = Modifier.semantics { contentDescription = searchActionDescription }) {
                Icon(Icons.Default.Search, contentDescription = null)
            }
            IconButton(onClick = ::refresh, enabled = !loading, modifier = Modifier.semantics { contentDescription = "Refresh messages" }) {
                Icon(Icons.Default.Refresh, contentDescription = null)
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        if (folder == MessagesInboxFolder.CHATS) {
            PrimaryTabRow(selectedTabIndex = MessagesFilter.entries.indexOf(filter)) {
                MessagesFilter.entries.forEach { option ->
                    Tab(
                        selected = filter == option,
                        onClick = { selectFilter(option) },
                        text = { Text(option.label) },
                    )
                }
            }
        }
        when {
            loading && result == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading messages" })
            }
            result is MessagesResult.Failure -> {
                val failure = result as MessagesResult.Failure
                InboxState("Messages could not load", failure.message, if (failure.authenticationRequired) "Sign in again" else "Try again", if (failure.authenticationRequired) onReauthenticate else ::refresh)
            }
            result is MessagesResult.Success && (result as MessagesResult.Success).page.conversations.isEmpty() ->
                InboxState(
                    when (folder) {
                        MessagesInboxFolder.CHATS -> "No conversations yet"
                        MessagesInboxFolder.REQUESTS -> "No message requests"
                        MessagesInboxFolder.SPAM -> "No chats flagged as spam"
                    },
                    when (folder) {
                        MessagesInboxFolder.CHATS -> "Your messages will appear here when you start a conversation."
                        MessagesInboxFolder.REQUESTS -> "New message requests will appear here."
                        MessagesInboxFolder.SPAM -> "Chats flagged as spam will appear here."
                    },
                )
            result is MessagesResult.Success -> {
                val page = (result as MessagesResult.Success).page
                LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Top) {
                    items(page.conversations, key = InboxConversation::id) { conversation ->
                        Column {
                            ConversationRow(conversation, onClick = {
                                selectedConversation = conversation
                                onOpenConversation(conversation)
                            })
                            if (folder != MessagesInboxFolder.CHATS) {
                                Column(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text(
                                        if (folder == MessagesInboxFolder.SPAM) conversation.spamReason ?: "Flagged by Nantty based on this account's activity." else "They won't see you've read this until you accept.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                    if (inboxActionError != null && pendingActionConversationId == null) Text(inboxActionError.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        if (folder == MessagesInboxFolder.REQUESTS) {
                                            OutlinedButton(onClick = { runInboxAction(conversation, "accept") }, enabled = pendingActionConversationId == null) { Text(if (pendingActionConversationId == conversation.id) "Working…" else "Accept") }
                                        } else {
                                            OutlinedButton(onClick = { runInboxAction(conversation, "not-spam") }, enabled = pendingActionConversationId == null) { Text(if (pendingActionConversationId == conversation.id) "Working…" else "Not spam") }
                                        }
                                        OutlinedButton(onClick = { runInboxAction(conversation, "delete") }, enabled = pendingActionConversationId == null) { Text("Delete") }
                                        OutlinedButton(onClick = { pendingBlockConversation = conversation }, enabled = pendingActionConversationId == null) { Text("Block") }
                                    }
                                }
                            }
                        }
                    }
                    item(key = "messages-pagination") {
                        when {
                            loadingMore -> Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                            pageError != null -> Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(pageError.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                                TextButton(onClick = ::loadMore) { Text("Try loading more") }
                            }
                            page.nextCursor != null -> TextButton(onClick = ::loadMore, modifier = Modifier.fillMaxWidth().padding(12.dp)) { Text("Load more conversations") }
                        }
                    }
                }
            }
            else -> InboxState("Connecting to Nantty", "Your conversations will appear here.")
        }
    }

    pendingBlockConversation?.let { conversation ->
        AlertDialog(
            onDismissRequest = { if (pendingActionConversationId == null) pendingBlockConversation = null },
            title = { Text("Block ${conversation.peerName}?") },
            text = { Text("They won't be able to message you. You can unblock them in chat settings.") },
            confirmButton = {
                TextButton(enabled = pendingActionConversationId == null, onClick = {
                    pendingBlockConversation = null
                    runInboxAction(conversation, "block")
                }) { Text("Block") }
            },
            dismissButton = { TextButton(onClick = { pendingBlockConversation = null }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun ConversationRow(conversation: InboxConversation, onClick: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.background) {
        Row(
            Modifier.fillMaxWidth().clickable(role = Role.Button, onClick = onClick).semantics(mergeDescendants = true) {
                contentDescription = buildString {
                    append(conversation.title)
                    append(", ${conversation.type.label}")
                    append(", ${formatConversationTime(conversation.lastMessageAt)}")
                    if (conversation.unreadCount > 0) append(", ${conversation.unreadCount} unread")
                }
            }.padding(horizontal = 20.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Surface(
                modifier = Modifier.size(48.dp),
                shape = CircleShape,
                color = MaterialTheme.colorScheme.secondaryContainer,
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Icons.Outlined.ChatBubbleOutline, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    conversation.avatarUrl?.let { avatarUrl ->
                        AsyncImage(
                            model = avatarUrl,
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize().clip(CircleShape),
                            contentScale = ContentScale.Crop,
                        )
                    }
                }
            }
            Column(Modifier.weight(1f).widthIn(max = 620.dp)) {
                Text(conversation.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${conversation.type.label} · ${formatConversationTime(conversation.lastMessageAt)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
            }
            if (conversation.unreadCount > 0) {
                Surface(shape = CircleShape, color = MaterialTheme.colorScheme.primary) {
                    Text(
                        conversation.unreadCount.coerceAtMost(99).toString(),
                        color = MaterialTheme.colorScheme.onPrimary,
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp)
                            .semantics { contentDescription = "${conversation.unreadCount} unread" },
                    )
                }
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
}

@Composable
internal fun InboxState(title: String, message: String, action: String? = null, onAction: (() -> Unit)? = null) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.secondary)
        if (action != null && onAction != null) TextButton(onClick = onAction) { Text(action) }
    }
}

private fun formatConversationTime(value: String): String = runCatching {
    DateTimeFormatter.ofPattern("MMM d · h:mm a").format(Instant.parse(value).atZone(ZoneId.systemDefault()))
}.getOrDefault("Recent")
