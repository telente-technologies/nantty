package com.nantty.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.activity.compose.BackHandler
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.nantty.android.R
import com.nantty.android.data.ConversationPage
import com.nantty.android.data.ConversationLookupResult
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.MessagesFilter
import com.nantty.android.data.MessagesHttpException
import com.nantty.android.data.MessagesInboxFolder
import com.nantty.android.data.MessagesResult
import com.nantty.android.data.LiveSessionsRepository
import com.nantty.android.data.StoriesRepository
import com.nantty.android.data.StoryAdsRepository
import com.nantty.android.data.StoryAdDestination
import com.nantty.android.ui.stories.MessagesStoryViewer
import com.nantty.android.ui.stories.rememberMessagesStoryNavigation
import java.util.concurrent.Executor

@Composable
internal fun MessagesScreen(
    repository: MessagesRepository,
    executor: Executor,
    modifier: Modifier = Modifier,
    onReauthenticate: () -> Unit = {},
    initialConversation: InboxConversation? = null,
    onInitialConversationHandled: () -> Unit = {},
    initialNotificationConversationId: String? = null,
    onInitialNotificationConversationHandled: () -> Unit = {},
    initialGroupInvitations: Boolean = false,
    onInitialGroupInvitationsHandled: () -> Unit = {},
    initialChannelInvitations: Boolean = false,
    onInitialChannelInvitationsHandled: () -> Unit = {},
    initialGroupInvitationToken: String? = null, onInitialGroupInvitationTokenHandled: () -> Unit = {},
    initialChannelInvitationToken: String? = null, onInitialChannelInvitationTokenHandled: () -> Unit = {},
    onOpenConversation: (InboxConversation) -> Unit = {},
    onOpenChatNotificationSettings: () -> Unit = {},
    externalRefreshGeneration: Int = 0,
    storiesRepository: StoriesRepository? = null,
    storyAdsRepository: StoryAdsRepository? = null,
    liveSessionsRepository: LiveSessionsRepository? = null,
    onOpenLive: (String) -> Unit = {},
    onOpenStoryAdDestination: (StoryAdDestination) -> Unit = {},
    currentUserAvatarUrl: String? = null,
    onAddStory: () -> Unit = {},
) {
    val searchActionDescription = stringResource(R.string.messages_search_action)
    val newMessageActionDescription = stringResource(R.string.new_message_action)
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
    var newMessageMode by remember(repository) { mutableStateOf(false) }
    var showCreateChannel by remember(repository) { mutableStateOf(false) }
    var channelName by remember(repository) { mutableStateOf("") }
    var channelDescription by remember(repository) { mutableStateOf("") }
    var creatingChannel by remember(repository) { mutableStateOf(false) }
    var createChannelError by remember(repository) { mutableStateOf<String?>(null) }
    var notificationTargetError by remember(repository) { mutableStateOf<String?>(null) }
    var showGroupInvitations by remember(repository) { mutableStateOf(false) }
    var showChannelInvitations by remember(repository) { mutableStateOf(false) }
    var showChannelLinks by remember(repository) { mutableStateOf(false) }
    var inviteGroupConversation by remember(repository) { mutableStateOf<InboxConversation?>(null) }
    val storyNavigation = rememberMessagesStoryNavigation(storiesRepository, storyAdsRepository, liveSessionsRepository, executor, onReauthenticate)
    var lastStoriesRefreshGeneration by remember(repository) { mutableIntStateOf(externalRefreshGeneration) }
    LaunchedEffect(externalRefreshGeneration) {
        if (externalRefreshGeneration != lastStoriesRefreshGeneration) storyNavigation.refreshTray()
        lastStoriesRefreshGeneration = externalRefreshGeneration
    }

    MessagesNotificationEntryEffects(
        repository = repository,
        executor = executor,
        initialConversation = initialConversation,
        onInitialConversationHandled = onInitialConversationHandled,
        conversationId = initialNotificationConversationId,
        onConversationHandled = onInitialNotificationConversationHandled,
        groupInvitations = initialGroupInvitations,
        onGroupInvitationsHandled = onInitialGroupInvitationsHandled,
        onShowGroupInvitations = { showGroupInvitations = true },
        channelInvitations = initialChannelInvitations,
        onChannelInvitationsHandled = onInitialChannelInvitationsHandled,
        onShowChannelInvitations = { showChannelInvitations = true },
        onOpenConversation = { conversation ->
            selectedConversation = conversation
            searchMode = false
            onOpenConversation(conversation)
        },
        onReauthenticate = onReauthenticate,
        onConversationFailure = { message -> notificationTargetError = message },
    )


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

    fun createChannel() {
        if (creatingChannel || channelName.isBlank()) return
        val requestedName = channelName
        val requestedDescription = channelDescription
        creatingChannel = true
        createChannelError = null
        executor.execute {
            val outcome = repository.createChannel(requestedName, requestedDescription)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                creatingChannel = false
                when (outcome) {
                    is ConversationLookupResult.Success -> {
                        showCreateChannel = false
                        channelName = ""
                        channelDescription = ""
                        refresh()
                        selectedConversation = outcome.conversation
                        onOpenConversation(outcome.conversation)
                    }
                    is ConversationLookupResult.Failure -> {
                        if (outcome.authenticationRequired) onReauthenticate()
                        else createChannelError = outcome.message
                    }
                }
            }
        }
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

    LaunchedEffect(repository, filter, folder, refreshVersion, externalRefreshGeneration) {
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

    if (newMessageMode) {
        NewMessagePickerScreen(
            repository = repository,
            executor = executor,
            onBack = { newMessageMode = false },
            onReauthenticate = onReauthenticate,
            onOpenConversation = { conversation ->
                newMessageMode = false
                selectedConversation = conversation
                onOpenConversation(conversation)
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
        MessagesInboxToolbar(
            folder = folder,
            folderMenuExpanded = folderMenuExpanded,
            onFolderMenuExpandedChange = { folderMenuExpanded = it },
            onSelectFolder = ::selectFolder,
            onOpenGroupInvitations = { showGroupInvitations = true },
            onOpenChannelInvitations = { showChannelInvitations = true },
            onManageChannelLinks = { showChannelLinks = true },
            onNewMessage = { newMessageMode = true; searchMode = false },
            newMessageDescription = newMessageActionDescription,
            onSearch = { searchMode = true },
            searchDescription = searchActionDescription,
            onCreateChannel = { showCreateChannel = true; createChannelError = null },
            onOpenSettings = onOpenChatNotificationSettings,
            onRefresh = ::refresh,
            refreshing = loading,
        )
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
        MessagesNotificationTargetError(notificationTargetError) { notificationTargetError = null }
        MessagesInboxContent(
            result = result,
            folder = folder,
            loading = loading,
            loadingMore = loadingMore,
            pageError = pageError,
            storiesRepository = storiesRepository,
            currentUserAvatarUrl = currentUserAvatarUrl,
            storyNavigation = storyNavigation,
            pendingActionConversationId = pendingActionConversationId,
            inboxActionError = inboxActionError,
            onReauthenticate = onReauthenticate,
            onAddStory = onAddStory,
            onLiveSelected = onOpenLive,
            onStorySelected = storyNavigation.openStory,
            onRetryStories = storyNavigation.refreshTray,
            onOpenConversation = { conversation ->
                selectedConversation = conversation
                onOpenConversation(conversation)
            },
            onInviteGroupMember = { inviteGroupConversation = it },
            onInboxAction = ::runInboxAction,
            onBlock = { pendingBlockConversation = it },
            onLoadMore = ::loadMore,
            onRefresh = ::refresh,
        )
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

    if (showCreateChannel) {
        CreateChannelDialog(
            name = channelName,
            description = channelDescription,
            busy = creatingChannel,
            error = createChannelError,
            onNameChange = { channelName = it },
            onDescriptionChange = { channelDescription = it },
            onDismiss = { showCreateChannel = false },
            onCreate = ::createChannel,
        )
    }

    if (showGroupInvitations) {
        GroupInvitationsDialog(
            repository = repository,
            executor = executor,
            onDismiss = { showGroupInvitations = false },
            onReauthenticate = onReauthenticate,
        )
    }

    ChannelInvitationOverlays(
        showInvitations = showChannelInvitations,
        showLinks = showChannelLinks,
        channels = availableChannelConversations((result as? MessagesResult.Success)?.page?.conversations.orEmpty()),
        token = initialChannelInvitationToken,
        repository = repository,
        executor = executor,
        onInvitationsVisibilityChange = { showChannelInvitations = it },
        onLinksVisibilityChange = { showChannelLinks = it },
        onChannelAccepted = channelAcceptanceHandler(
            repository = repository,
            executor = executor,
            onOpened = { conversation ->
                showChannelInvitations = false
                refresh()
                selectedConversation = conversation
                searchMode = false
                onOpenConversation(conversation)
            },
            onFailure = { message, authenticationRequired ->
                inboxActionError = message
                if (authenticationRequired) onReauthenticate()
            },
        ),
        onTokenHandled = onInitialChannelInvitationTokenHandled,
        onReauthenticate = onReauthenticate,
    )
    GroupInvitationLinkRoute(initialGroupInvitationToken, repository, executor, onInitialGroupInvitationTokenHandled, { showGroupInvitations = true }, onReauthenticate)

    inviteGroupConversation?.let { conversation ->
        InviteGroupMemberDialog(
            conversation = conversation,
            repository = repository,
            executor = executor,
            onDismiss = { inviteGroupConversation = null },
            onReauthenticate = onReauthenticate,
            onInvitationSent = { refresh() },
        )
    }

    MessagesStoryViewer(storiesRepository, storyAdsRepository, executor, storyNavigation, onReauthenticate, onOpenStoryAdDestination)
}
