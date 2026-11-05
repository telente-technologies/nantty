package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import coil.compose.AsyncImage
import com.nantty.android.data.ConnectionListPreference
import com.nantty.android.data.ConnectionListPreferencesStore
import com.nantty.android.data.ProfileConnection
import com.nantty.android.data.ProfileConnectionPage
import com.nantty.android.data.ProfileConnectionsResult
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.StartConversationResult
import java.util.concurrent.Executor
import kotlinx.coroutines.delay

@Composable
internal fun ProfileConnectionsScreen(
    userId: String,
    initialTab: String,
    repository: PublicProfileRepository,
    executor: Executor,
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit,
    onRequireSignIn: () -> Unit = {},
    messagesRepository: MessagesRepository? = null,
    onOpenConversation: (InboxConversation) -> Unit = {},
) {
    val context = LocalContext.current.applicationContext
    val preferencesStore = remember(context) { ConnectionListPreferencesStore(context) }
    val viewerId = repository.viewerId()
    val isOwnConnections = viewerId == userId
    val visibleTabs = if (isOwnConnections) CONNECTION_TABS else CONNECTION_TABS.filterNot { it in OWNER_ONLY_CONNECTION_TABS }
    var tab by remember(userId, viewerId) { mutableStateOf(initialTab.takeIf { it in visibleTabs } ?: "followers") }
    var query by remember(userId) { mutableStateOf("") }
    val preferenceKey = "connections:$tab"
    var preference by remember(userId, tab) { mutableStateOf(preferencesStore.read(preferenceKey)) }
    var showingSortFilter by remember(userId) { mutableStateOf(false) }
    val serverSearchQuery = query.trim().takeIf { tab == "followers" || tab == "following" }.orEmpty()
    var page by remember(userId, tab, serverSearchQuery) { mutableStateOf(ProfileConnectionPage(emptyList(), null)) }
    var loading by remember(userId, tab, serverSearchQuery) { mutableStateOf(true) }
    var loadingMore by remember(userId, tab, serverSearchQuery) { mutableStateOf(false) }
    var error by remember(userId, tab, serverSearchQuery) { mutableStateOf<String?>(null) }
    var privateList by remember(userId, tab, serverSearchQuery) { mutableStateOf(false) }
    var generation by remember(userId) { mutableStateOf(0) }
    var retry by remember(userId, tab, serverSearchQuery) { mutableStateOf(0) }
    var actionBusyId by remember(userId) { mutableStateOf<String?>(null) }
    var actionError by remember(userId) { mutableStateOf<String?>(null) }
    var startingConversationId by remember(userId) { mutableStateOf<String?>(null) }
    var pendingUnfollow by remember(userId) { mutableStateOf<ProfileConnection?>(null) }
    var pendingBlock by remember(userId) { mutableStateOf<ProfileConnection?>(null) }
    var openMoreId by remember(userId) { mutableStateOf<String?>(null) }
    val visibleEntries = if (tab == "followers" || tab == "following" || query.isBlank()) page.entries else {
        page.entries.filter { entry ->
            "${entry.name} ${entry.username}".contains(query.trim(), ignoreCase = true)
        }
    }
    val orderedEntries = sortAndFilterConnections(
        entries = visibleEntries,
        preference = preference,
        showRelationshipFilter = tab != "blocked",
    )

    fun load(cursor: String? = null, append: Boolean = false) {
        if (append && loadingMore) return
        if (append) loadingMore = true else loading = true
        error = null
        privateList = false
        val requestedTab = tab
        val requestedQuery = serverSearchQuery
        val requestedGeneration = generation
        executor.execute {
            val result = repository.loadConnections(userId, requestedTab, requestedQuery, cursor)
            Snapshot.withMutableSnapshot {
                if (tab == requestedTab && serverSearchQuery == requestedQuery && generation == requestedGeneration) {
                    when (result) {
                        is ProfileConnectionsResult.Failure -> {
                            error = result.message
                            privateList = result.isPrivate
                        }
                        is ProfileConnectionsResult.Success -> page = if (append) {
                            val merged = (page.entries + result.page.entries).distinctBy(ProfileConnection::id)
                            result.page.copy(entries = merged)
                        } else result.page
                    }
                    loading = false
                    loadingMore = false
                }
            }
        }
    }

    fun changeFollow(entry: ProfileConnection, follow: Boolean) {
        if (viewerId == null) {
            onRequireSignIn()
            return
        }
        if (actionBusyId != null) return
        actionBusyId = entry.id
        actionError = null
        executor.execute {
            val result = repository.setFollow(entry.id, follow)
            Snapshot.withMutableSnapshot {
                when (result) {
                    is com.nantty.android.data.FollowActionResult.Failure -> actionError = result.message
                    is com.nantty.android.data.FollowActionResult.Success -> {
                        page = page.copy(entries = page.entries.map { current ->
                            if (current.id != entry.id) current else current.copy(
                                followState = result.state,
                                isFollowing = result.state == "accepted",
                            )
                        })
                    }
                }
                actionBusyId = null
            }
        }
    }

    fun changeBlock(entry: ProfileConnection, block: Boolean) {
        if (viewerId == null) {
            onRequireSignIn()
            return
        }
        if (actionBusyId != null) return
        actionBusyId = entry.id
        actionError = null
        executor.execute {
            val result = repository.setBlocked(entry.id, block)
            Snapshot.withMutableSnapshot {
                when (result) {
                    is com.nantty.android.data.BlockActionResult.Failure -> actionError = result.message
                    com.nantty.android.data.BlockActionResult.Success -> {
                        page = page.copy(entries = page.entries.map { current ->
                            if (current.id != entry.id) current else current.copy(
                                followState = if (block) "blocked" else "none",
                                isFollowing = false,
                            )
                        })
                    }
                }
                actionBusyId = null
            }
        }
    }

    fun startConversation(entry: ProfileConnection) {
        if (viewerId == null) {
            onRequireSignIn()
            return
        }
        if (messagesRepository == null || startingConversationId != null) return
        startingConversationId = entry.id
        actionError = null
        executor.execute {
            val started = messagesRepository.startConversationWithPerson(entry.id)
            var conversationToOpen: InboxConversation? = null
            var authenticationRequired = false
            Snapshot.withMutableSnapshot {
                startingConversationId = null
                when (started) {
                    is StartConversationResult.Failure -> {
                        actionError = started.message
                        authenticationRequired = started.authenticationRequired
                    }
                    is StartConversationResult.Success -> conversationToOpen = started.conversation
                }
            }
            if (authenticationRequired) Snapshot.withMutableSnapshot { onRequireSignIn() }
            conversationToOpen?.let { conversation ->
                Snapshot.withMutableSnapshot { onOpenConversation(conversation) }
            }
        }
    }

    LaunchedEffect(userId, tab, serverSearchQuery, retry, generation) {
        if (serverSearchQuery.isNotBlank()) delay(300)
        load()
    }

    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack, modifier = Modifier.size(48.dp).semantics { contentDescription = "Back to profile" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Text(connectionTabLabel(tab), Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            TextButton(
                onClick = { showingSortFilter = true },
                modifier = Modifier.semantics {
                    contentDescription = "Sort and filter. ${preference.sort.label}${if (preference.filter != com.nantty.android.data.ConnectionFilter.ALL) ", filters on" else ""}"
                },
            ) { Text("Sort and filter") }
        }
        OutlinedTextField(
            value = query,
            onValueChange = { query = it.take(PublicProfileRepository.MAX_CONNECTION_QUERY_LENGTH) },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            placeholder = { Text("Search people") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            singleLine = true,
        )
        PrimaryTabRow(selectedTabIndex = visibleTabs.indexOf(tab).coerceAtLeast(0)) {
            visibleTabs.forEach { key ->
                Tab(selected = tab == key, onClick = { if (tab != key) tab = key }, text = { Text(connectionTabLabel(key)) })
            }
        }
        PullToRefreshBox(
            isRefreshing = loading && page.entries.isNotEmpty(),
            onRefresh = { generation += 1 },
            modifier = Modifier.fillMaxSize(),
        ) {
            when {
                loading && page.entries.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                error != null && page.entries.isEmpty() -> if (privateList) {
                    ConnectionListMessage("This list is private", "Follow them to see their followers and following.")
                } else ConnectionListMessage(
                    title = "Couldn't load this list",
                    detail = error,
                    action = "Try again",
                    onAction = { retry += 1 },
                )
                else -> LazyColumn(Modifier.fillMaxSize()) {
                    actionError?.let { message -> item(key = "connection-action-error") {
                        Text(message, Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), color = MaterialTheme.colorScheme.error)
                    } }
                    items(orderedEntries, key = ProfileConnection::id) { entry ->
                        ProfileConnectionRow(
                            entry = entry,
                            isViewer = entry.id == viewerId,
                            isBlockedTab = tab == "blocked",
                            actionBusy = actionBusyId == entry.id,
                            moreOpen = openMoreId == entry.id,
                            onClick = { onOpenProfile(entry.id) },
                            onFollowAction = {
                                when {
                                    tab == "blocked" -> changeBlock(entry, false)
                                    entry.followState in setOf("accepted", "requested") -> pendingUnfollow = entry
                                    entry.followState == "blocked" -> Unit
                                    else -> changeFollow(entry, true)
                                }
                            },
                            onMore = { openMoreId = entry.id },
                            onDismissMore = { openMoreId = null },
                            onBlockAction = {
                                openMoreId = null
                                if (entry.followState == "blocked") changeBlock(entry, false)
                                else pendingBlock = entry
                            },
                            onMessage = {
                                openMoreId = null
                                startConversation(entry)
                            },
                            canMessage = messagesRepository != null && tab != "blocked" && entry.followState != "blocked",
                            messageBusy = startingConversationId == entry.id,
                        )
                    }
                    if (error != null) item(key = "connection-error") {
                        ConnectionListMessage("More people couldn't load", error, "Try again") { retry += 1 }
                    }
                    if (page.entries.isEmpty() && preference.filter == com.nantty.android.data.ConnectionFilter.ALL && error == null && !loading) item(key = "connection-empty") {
                        ConnectionListMessage(
                            if (query.isBlank()) "Nobody here yet" else "No one matches \"${query.trim()}\"",
                            if (query.isBlank()) "This list is empty." else "Try a different name or username.",
                        )
                    }
                    if (page.entries.isNotEmpty() && orderedEntries.isEmpty() && !loading) item(key = "connection-filter-empty") {
                        ConnectionListMessage(
                            if (query.isNotBlank()) "No one matches \"${query.trim()}\"" else "No people match this filter",
                            if (query.isNotBlank()) "Try a different name or username." else "Change the relationship filter to see more people.",
                        )
                    }
                    page.nextCursor?.let { cursor -> item(key = "connection-more") {
                        TextButton(
                            onClick = { load(cursor, append = true) },
                            enabled = !loadingMore,
                            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                        ) {
                            if (loadingMore) CircularProgressIndicator(Modifier.size(20.dp)) else Text("Load more")
                        }
                    } }
                }
            }
        }
    }

    pendingUnfollow?.let { entry ->
        val isRequest = entry.followState == "requested"
        AlertDialog(
            onDismissRequest = { pendingUnfollow = null },
            title = { Text(if (isRequest) "Cancel follow request?" else "Unfollow @${entry.username}?") },
            text = {
                Text(
                    if (isRequest) "@${entry.username} won't see your request any more. You can ask again later."
                    else "Their posts will no longer show up in your Following feed.",
                )
            },
            confirmButton = {
                TextButton(onClick = { pendingUnfollow = null; changeFollow(entry, false) }) {
                    Text(if (isRequest) "Cancel request" else "Unfollow")
                }
            },
            dismissButton = { TextButton(onClick = { pendingUnfollow = null }) { Text(if (isRequest) "Keep request" else "Cancel") } },
        )
    }

    pendingBlock?.let { entry ->
        AlertDialog(
            onDismissRequest = { pendingBlock = null },
            title = { Text("Block ${entry.name}?") },
            text = { Text("They won't be able to find your profile, see your posts, or message you. They won't be told you blocked them.") },
            confirmButton = {
                TextButton(onClick = { pendingBlock = null; changeBlock(entry, true) }) { Text("Block") }
            },
            dismissButton = { TextButton(onClick = { pendingBlock = null }) { Text("Cancel") } },
        )
    }

    ConnectionSortFilterSheet(
        visible = showingSortFilter,
        value = preference,
        showRelationshipFilter = tab != "blocked",
        onChange = { next ->
            preference = next
            preferencesStore.write(preferenceKey, next)
        },
        onClose = { showingSortFilter = false },
    )
}

@Composable
private fun connectionTabLabel(tab: String) = when (tab) {
    "following" -> "Following"
    "shopped" -> "Shopped"
    "suggested" -> "Suggested"
    "blocked" -> "Blocked"
    else -> "Followers"
}

@Composable
private fun ProfileConnectionRow(
    entry: ProfileConnection,
    isViewer: Boolean,
    isBlockedTab: Boolean,
    actionBusy: Boolean,
    moreOpen: Boolean,
    onClick: () -> Unit,
    onFollowAction: () -> Unit,
    onMore: () -> Unit,
    onDismissMore: () -> Unit,
    onBlockAction: () -> Unit,
    onMessage: () -> Unit,
    canMessage: Boolean,
    messageBusy: Boolean,
) {
    androidx.compose.material3.ListItem(
        headlineContent = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(entry.name, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold)
                if (entry.verified) Text("✓", Modifier.padding(start = 4.dp), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            }
        },
        supportingContent = { Text("@${entry.username}", maxLines = 1, overflow = TextOverflow.Ellipsis) },
        leadingContent = {
            Surface(Modifier.size(48.dp), shape = CircleShape, color = MaterialTheme.colorScheme.secondaryContainer) {
                Box(contentAlignment = Alignment.Center) {
                    Text(entry.name.firstOrNull()?.uppercase() ?: "N", fontWeight = FontWeight.Bold)
                    entry.avatarUrl?.let { AsyncImage(it, contentDescription = "${entry.name}'s profile photo", modifier = Modifier.fillMaxSize().clip(CircleShape)) }
                }
            }
        },
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).semantics { contentDescription = "${entry.name}, @${entry.username}" },
        trailingContent = if (isViewer) null else ({
            Row(verticalAlignment = Alignment.CenterVertically) {
            val label = if (isBlockedTab) "Unblock" else when (entry.followState) {
                "accepted" -> "Following"
                "requested" -> "Requested"
                "blocked" -> "Blocked"
                else -> "Follow"
            }
            if (entry.followState == "blocked" && !isBlockedTab) {
                Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
            } else if (isBlockedTab || entry.followState == "none" || entry.followState == "rejected") {
                Button(onClick = onFollowAction, enabled = !actionBusy, modifier = Modifier.heightIn(min = 40.dp).semantics { contentDescription = "$label ${entry.name}" }) {
                    if (actionBusy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text(label)
                }
            } else {
                FilledTonalButton(onClick = onFollowAction, enabled = !actionBusy, modifier = Modifier.heightIn(min = 40.dp).semantics { contentDescription = "$label ${entry.name}" }) {
                    if (actionBusy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text(label)
                }
            }
            Box {
                IconButton(
                    onClick = onMore,
                    enabled = !actionBusy,
                    modifier = Modifier.size(48.dp).semantics { contentDescription = "More options for ${entry.name}" },
                ) { Icon(Icons.Default.MoreVert, contentDescription = null) }
                DropdownMenu(expanded = moreOpen, onDismissRequest = onDismissMore) {
                    DropdownMenuItem(text = { Text("View profile") }, onClick = { onDismissMore(); onClick() })
                    if (canMessage) DropdownMenuItem(
                        text = { Text(if (messageBusy) "Opening conversation…" else "Send message") },
                        enabled = !messageBusy,
                        onClick = onMessage,
                    )
                    DropdownMenuItem(
                        text = { Text(if (entry.followState == "blocked") "Unblock ${entry.name}" else "Block ${entry.name}") },
                        onClick = onBlockAction,
                    )
                }
            }
            }
        }),
    )
    androidx.compose.material3.HorizontalDivider()
}

@Composable
private fun ConnectionListMessage(title: String, detail: String?, action: String? = null, onAction: (() -> Unit)? = null) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        detail?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
        if (action != null && onAction != null) TextButton(onClick = onAction, modifier = Modifier.heightIn(min = 48.dp)) { Text(action) }
    }
}

private val CONNECTION_TABS = listOf("followers", "following", "shopped", "suggested", "blocked")
private val OWNER_ONLY_CONNECTION_TABS = setOf("shopped", "suggested", "blocked")
