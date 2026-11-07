package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.nantty.android.data.ConversationType
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesInboxFolder
import com.nantty.android.data.MessagesResult
import com.nantty.android.data.StoriesRepository
import com.nantty.android.ui.stories.MessagesStoryNavigationState

@Composable
internal fun MessagesInboxContent(
    result: MessagesResult?,
    folder: MessagesInboxFolder,
    loading: Boolean,
    loadingMore: Boolean,
    pageError: String?,
    storiesRepository: StoriesRepository?,
    currentUserAvatarUrl: String?,
    storyNavigation: MessagesStoryNavigationState,
    pendingActionConversationId: String?,
    inboxActionError: String?,
    onReauthenticate: () -> Unit,
    onAddStory: () -> Unit,
    onLiveSelected: (String) -> Unit,
    onStorySelected: (String) -> Unit,
    onRetryStories: () -> Unit,
    onOpenConversation: (InboxConversation) -> Unit,
    onInviteGroupMember: (InboxConversation) -> Unit,
    onInboxAction: (InboxConversation, String) -> Unit,
    onBlock: (InboxConversation) -> Unit,
    onLoadMore: () -> Unit,
    onRefresh: () -> Unit,
) {
    when {
        loading && result == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading messages" })
        }
        result is MessagesResult.Failure -> {
            val failure = result
            InboxState(
                "Messages could not load",
                failure.message,
                if (failure.authenticationRequired) "Sign in again" else "Try again",
                if (failure.authenticationRequired) onReauthenticate else onRefresh,
            )
        }
        result is MessagesResult.Success && result.page.conversations.isEmpty() -> {
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
        }
        result is MessagesResult.Success -> {
            val page = result.page
            LazyColumn(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Top) {
                messagesStoriesTrayItem(
                    enabled = storiesRepository != null,
                    result = storyNavigation.trayResult,
                    folder = folder,
                    myAvatarUrl = currentUserAvatarUrl,
                    liveEntries = storyNavigation.liveEntries,
                    onStorySelected = onStorySelected,
                    onLiveSelected = onLiveSelected,
                    onAddStory = onAddStory,
                    onRetry = onRetryStories,
                    onReauthenticate = onReauthenticate,
                )
                items(page.conversations, key = InboxConversation::id) { conversation ->
                    Column {
                        ConversationRow(conversation, onClick = { onOpenConversation(conversation) })
                        if (conversation.type == ConversationType.GROUP) {
                            TextButton(
                                onClick = { onInviteGroupMember(conversation) },
                                modifier = Modifier.padding(start = 76.dp, bottom = 4.dp)
                                    .semantics { contentDescription = "Invite a member to ${conversation.title}" },
                            ) { Text("Invite member") }
                        }
                        if (folder != MessagesInboxFolder.CHATS) {
                            MessageRequestActions(
                                conversation = conversation,
                                folder = folder,
                                pendingActionConversationId = pendingActionConversationId,
                                actionError = inboxActionError,
                                onAction = { onInboxAction(conversation, it) },
                                onBlock = { onBlock(conversation) },
                            )
                        }
                    }
                }
                item(key = "messages-pagination") {
                    when {
                        loadingMore -> Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                        pageError != null -> Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(pageError, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                            TextButton(onClick = onLoadMore) { Text("Try loading more") }
                        }
                        page.nextCursor != null -> TextButton(onClick = onLoadMore, modifier = Modifier.fillMaxWidth().padding(12.dp)) { Text("Load more conversations") }
                    }
                }
            }
        }
        else -> InboxState("Connecting to Nantty", "Your conversations will appear here.")
    }
}
