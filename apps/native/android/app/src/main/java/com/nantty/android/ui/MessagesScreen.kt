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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.ConversationPage
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.MessagesResult
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.Executor

@Composable
internal fun MessagesScreen(repository: MessagesRepository, executor: Executor, modifier: Modifier = Modifier, onReauthenticate: () -> Unit = {}, onOpenConversation: (InboxConversation) -> Unit = {}) {
    var selectedConversation by remember(repository) { mutableStateOf<InboxConversation?>(null) }
    var result by remember(repository) { mutableStateOf<MessagesResult?>(null) }
    var loading by remember(repository) { mutableStateOf(false) }
    var loadingMore by remember(repository) { mutableStateOf(false) }
    var pageError by remember(repository) { mutableStateOf<String?>(null) }

    fun refresh() {
        if (loading) return
        loading = true
        pageError = null
        result = null
        executor.execute {
            val loaded = repository.load()
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                result = loaded
                loading = false
            }
        }
    }

    fun loadMore() {
        val current = (result as? MessagesResult.Success)?.page ?: return
        val cursor = current.nextCursor ?: return
        if (loadingMore) return
        loadingMore = true
        pageError = null
        executor.execute {
            val loaded = repository.load(cursor)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
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

    LaunchedEffect(repository) { refresh() }

    BackHandler(enabled = selectedConversation != null) { selectedConversation = null }
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

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Messages", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            IconButton(onClick = ::refresh, enabled = !loading, modifier = Modifier.semantics { contentDescription = "Refresh messages" }) {
                Icon(Icons.Default.Refresh, contentDescription = null)
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        when {
            loading && result == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading messages" })
            }
            result is MessagesResult.Failure -> {
                val failure = result as MessagesResult.Failure
                InboxState("Messages could not load", failure.message, if (failure.authenticationRequired) "Sign in again" else "Try again", if (failure.authenticationRequired) onReauthenticate else ::refresh)
            }
            result is MessagesResult.Success && (result as MessagesResult.Success).page.conversations.isEmpty() ->
                InboxState("No conversations yet", "Your messages will appear here when you start a conversation.")
            result is MessagesResult.Success -> {
                val page = (result as MessagesResult.Success).page
                LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Top) {
                    items(page.conversations, key = InboxConversation::id) { conversation ->
                        ConversationRow(conversation, onClick = {
                            selectedConversation = conversation
                            onOpenConversation(conversation)
                        })
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
private fun InboxState(title: String, message: String, action: String? = null, onAction: (() -> Unit)? = null) {
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
