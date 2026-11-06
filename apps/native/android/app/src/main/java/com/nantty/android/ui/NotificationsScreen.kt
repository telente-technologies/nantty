package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
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
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nantty.android.data.ActivityNotification
import com.nantty.android.data.ConversationLookupResult
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.NotificationFilter
import com.nantty.android.data.NotificationPage
import com.nantty.android.data.NotificationsRepository
import com.nantty.android.data.NotificationsResult
import com.nantty.android.data.NotificationDestination
import com.nantty.android.data.resolveNotificationDestination
import com.nantty.android.data.AccountNotificationSettingsRepository
import java.util.concurrent.Executor

@Composable
internal fun NotificationsScreen(repository: NotificationsRepository, executor: Executor, modifier: Modifier = Modifier, onReauthenticate: () -> Unit = {}, onOpenPost: (String) -> Unit = {}, onOpenPostComment: (String, String) -> Unit = { postId, _ -> onOpenPost(postId) }, onOpenProfile: (String) -> Unit = {}, onOpenMessages: () -> Unit = {}, onOpenConversation: (InboxConversation) -> Unit = {}, messagesRepository: MessagesRepository? = null, onOpenOrders: () -> Unit = {}, accountSettingsRepository: AccountNotificationSettingsRepository? = null, onOpenFollowRequests: () -> Unit = {}, onOpenGroupInvitations: () -> Unit = {}, onOpenSpaces: () -> Unit = {}, onOpenSupportTicket: (String) -> Unit = {}, onOpenDispute: (String) -> Unit = {}, onOpenClip: (String) -> Unit = {}, onOpenOrder: (String) -> Unit = {}) {
    var showingSettings by remember(repository) { mutableStateOf(false) }
    var filter by remember(repository) { mutableStateOf(NotificationFilter.ALL) }
    var result by remember(repository) { mutableStateOf<NotificationsResult?>(null) }
    var loading by remember(repository) { mutableStateOf(false) }
    var loadingMore by remember(repository) { mutableStateOf(false) }
    var actionMessage by remember(repository) { mutableStateOf<String?>(null) }
    var conversationOpenError by remember(repository) { mutableStateOf<String?>(null) }
    var openingConversationId by remember(repository) { mutableStateOf<String?>(null) }
    var generation by remember(repository) { mutableStateOf(0) }

    fun refresh(clear: Boolean = false) {
        if (loading) return
        val requestFilter = filter
        val requestGeneration = generation
        loading = true
        actionMessage = null
        if (clear) result = null
        executor.execute {
            val next = repository.load(requestFilter)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (filter == requestFilter && generation == requestGeneration) {
                    result = next
                    loading = false
                }
            }
        }
    }

    fun loadMore() {
        val current = (result as? NotificationsResult.Success)?.page ?: return
        val cursor = current.nextCursor ?: return
        if (loadingMore) return
        val requestFilter = filter
        val requestGeneration = generation
        loadingMore = true
        actionMessage = null
        executor.execute {
            val next = repository.load(requestFilter, cursor)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (filter == requestFilter && generation == requestGeneration) {
                    when (next) {
                        is NotificationsResult.Failure -> actionMessage = next.message
                        is NotificationsResult.Success -> {
                            val latest = (result as? NotificationsResult.Success)?.page ?: current
                            val merged = (latest.items + next.page.items).distinctBy(ActivityNotification::id)
                            result = NotificationsResult.Success(NotificationPage(merged, next.page.nextCursor))
                        }
                    }
                    loadingMore = false
                }
            }
        }
    }

    fun selectFilter(next: NotificationFilter) {
        if (next == filter) return
        filter = next
        generation += 1
        result = null
        loading = false
        loadingMore = false
        refresh(clear = true)
    }

    fun markOneRead(notification: ActivityNotification) {
        if (notification.read) return
        executor.execute {
            val outcome = repository.markRead(notification.id)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (outcome.isSuccess) {
                    val success = result as? NotificationsResult.Success
                    if (success != null) result = success.copy(page = success.page.copy(items = success.page.items.map { if (it.id == notification.id) it.copy(read = true) else it }))
                } else actionMessage = outcome.exceptionOrNull()?.message ?: "Could not mark notification as read. Try again."
            }
        }
    }

    fun markAllRead() {
        executor.execute {
            val outcome = repository.markAllRead()
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (outcome.isSuccess) {
                    val success = result as? NotificationsResult.Success
                    if (success != null) result = success.copy(page = success.page.copy(items = success.page.items.map { it.copy(read = true) }))
                } else actionMessage = outcome.exceptionOrNull()?.message ?: "Could not mark notifications as read. Try again."
            }
        }
    }

    LaunchedEffect(repository) { refresh(clear = true) }

    if (showingSettings && accountSettingsRepository != null) {
        AccountNotificationSettingsScreen(
            repository = accountSettingsRepository,
            executor = executor,
            onBack = { showingSettings = false },
            onReauthenticate = onReauthenticate,
            modifier = modifier,
        )
        return
    }

    Column(modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 8.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Activity", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            val hasUnread = (result as? NotificationsResult.Success)?.page?.items?.any { !it.read } == true
            if (hasUnread) TextButton(onClick = ::markAllRead) { Text("Mark all read") }
            if (accountSettingsRepository != null) IconButton(
                onClick = { showingSettings = true },
                modifier = Modifier.semantics { contentDescription = "Notification settings" },
            ) { Icon(Icons.Default.Settings, contentDescription = null) }
            IconButton(onClick = { refresh() }, enabled = !loading, modifier = Modifier.semantics { contentDescription = "Refresh notifications" }) {
                Icon(Icons.Default.Refresh, contentDescription = null)
            }
        }
        TabRow(selectedTabIndex = NotificationFilter.entries.indexOf(filter)) {
            NotificationFilter.entries.forEach { option ->
                Tab(selected = filter == option, onClick = { selectFilter(option) }, text = { Text(option.label) })
            }
        }
        actionMessage?.let { Text(it, Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 6.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        conversationOpenError?.let { Text(it, Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 6.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        when (val current = result) {
            null -> CenterMessage("Loading activity…", progress = true)
            is NotificationsResult.Failure -> if (loading) CenterMessage("Refreshing activity…", progress = true) else CenterMessage(
                if (current.authenticationRequired) "Your session has expired. Sign in again to view activity." else "Couldn't load activity. ${current.message}",
                action = if (current.authenticationRequired) onReauthenticate else ({ refresh(clear = true) }),
                actionLabel = if (current.authenticationRequired) "Sign in again" else "Try again",
            )
            is NotificationsResult.Success -> if (current.page.items.isEmpty()) {
                CenterMessage(if (filter == NotificationFilter.MENTIONS) "No mentions yet" else "You’re all caught up", "New activity will appear here.")
            } else LazyColumn(Modifier.fillMaxSize()) {
                items(current.page.items, key = ActivityNotification::id) { item ->
                    NotificationRow(item, onClick = {
                        markOneRead(item)
                        when (val destination = resolveNotificationDestination(item)) {
                            is NotificationDestination.Post -> destination.commentId?.let { onOpenPostComment(destination.postId, it) } ?: onOpenPost(destination.postId)
                            is NotificationDestination.Profile -> onOpenProfile(destination.userId)
                            is NotificationDestination.Conversation -> {
                                val messages = messagesRepository
                                if (messages == null) onOpenMessages()
                                else if (openingConversationId == null) {
                                    openingConversationId = destination.conversationId
                                    actionMessage = null
                                    conversationOpenError = null
                                    executor.execute {
                                        val lookup = messages.loadConversationById(destination.conversationId)
                                        androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                            openingConversationId = null
                                            when (lookup) {
                                                is ConversationLookupResult.Success -> {
                                                    messages.setNotificationMessageTarget(destination.conversationId, destination.messageId)
                                                    onOpenConversation(lookup.conversation)
                                                }
                                                is ConversationLookupResult.Failure -> {
                                                    conversationOpenError = lookup.message
                                                    if (lookup.authenticationRequired) onReauthenticate()
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            NotificationDestination.Messages -> onOpenMessages()
                            NotificationDestination.Orders -> onOpenOrders()
                            is NotificationDestination.OrderDetail -> onOpenOrder(destination.orderId)
                            NotificationDestination.FollowRequests -> onOpenFollowRequests()
                            NotificationDestination.GroupInvitations -> onOpenGroupInvitations()
                            NotificationDestination.Spaces -> onOpenSpaces()
                            is NotificationDestination.SupportTicket -> onOpenSupportTicket(destination.ticketId)
                            is NotificationDestination.Dispute -> onOpenDispute(destination.disputeId)
                            is NotificationDestination.Clip -> onOpenClip(destination.clipId)
                            null -> Unit
                        }
                    })
                }
                item(key = "notification-pagination") {
                    when {
                        openingConversationId != null -> Row(Modifier.fillMaxWidth().padding(20.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(Modifier.size(18.dp))
                            Text("Opening conversation…", Modifier.padding(start = 10.dp), style = MaterialTheme.typography.bodySmall)
                        }
                        loadingMore -> CircularProgressIndicator(Modifier.padding(20.dp).semantics { contentDescription = "Loading more notifications" })
                        actionMessage != null -> TextButton(onClick = ::loadMore, modifier = Modifier.fillMaxWidth()) { Text("Try loading more") }
                        current.page.nextCursor != null -> TextButton(onClick = ::loadMore, modifier = Modifier.fillMaxWidth().padding(8.dp)) { Text("Load more") }
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationRow(item: ActivityNotification, onClick: () -> Unit) {
    Column {
        Row(
            Modifier.fillMaxWidth().background(if (!item.read) MaterialTheme.colorScheme.surfaceContainerLow else MaterialTheme.colorScheme.background)
                .clickable(onClick = onClick).padding(horizontal = 18.dp, vertical = 14.dp)
                .semantics(mergeDescendants = true) { contentDescription = "${item.title} ${item.body}${if (item.read) "" else ", unread"}" },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(Modifier.size(40.dp).background(MaterialTheme.colorScheme.primaryContainer, CircleShape), contentAlignment = Alignment.Center) {
                if (item.actor == null) Icon(Icons.Default.NotificationsNone, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
                else Text(item.actor.name.take(1).uppercase(), color = MaterialTheme.colorScheme.onPrimaryContainer, fontWeight = FontWeight.Bold)
            }
            Column(Modifier.weight(1f)) {
                Text(item.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                if (item.body.isNotBlank()) Text(item.body, style = MaterialTheme.typography.bodySmall, maxLines = 3, overflow = TextOverflow.Ellipsis)
                Text(item.createdAt, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (!item.read) Box(Modifier.size(8.dp).background(MaterialTheme.colorScheme.primary, CircleShape))
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
}

@Composable
private fun CenterMessage(message: String, detail: String? = null, progress: Boolean = false, action: (() -> Unit)? = null, actionLabel: String = "Try again") {
    Column(Modifier.fillMaxSize().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        if (progress) CircularProgressIndicator()
        Text(message, Modifier.padding(top = if (progress) 16.dp else 0.dp), style = MaterialTheme.typography.bodyLarge)
        detail?.let { Text(it, Modifier.padding(top = 6.dp), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        action?.let { TextButton(onClick = it) { Text(actionLabel) } }
    }
}
