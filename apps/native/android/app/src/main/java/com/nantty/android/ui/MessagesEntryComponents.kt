package com.nantty.android.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.MessagesInboxFolder
import com.nantty.android.data.StoryTrayResult
import com.nantty.android.data.StoriesRepository
import com.nantty.android.ui.stories.StoriesTray
import java.util.concurrent.Executor

internal fun LazyListScope.messagesStoriesTrayItem(
    enabled: Boolean,
    result: StoryTrayResult?,
    folder: MessagesInboxFolder,
    myAvatarUrl: String?,
    onStorySelected: (String) -> Unit,
    onAddStory: () -> Unit,
    onRetry: () -> Unit,
    onReauthenticate: () -> Unit,
) {
    if (!enabled) return
    item(key = "stories-tray") {
        MessagesStoriesTrayItem(result, folder, myAvatarUrl, onStorySelected, onAddStory, onRetry, onReauthenticate)
    }
}

@Composable
internal fun MessagesNotificationEntryEffects(
    repository: MessagesRepository,
    executor: Executor,
    initialConversation: InboxConversation?,
    onInitialConversationHandled: () -> Unit,
    conversationId: String?,
    onConversationHandled: () -> Unit,
    groupInvitations: Boolean,
    onGroupInvitationsHandled: () -> Unit,
    onShowGroupInvitations: () -> Unit,
    channelInvitations: Boolean,
    onChannelInvitationsHandled: () -> Unit,
    onShowChannelInvitations: () -> Unit,
    onOpenConversation: (InboxConversation) -> Unit,
    onReauthenticate: () -> Unit,
    onConversationFailure: (String) -> Unit,
) {
    LaunchedEffect(repository, initialConversation?.id) {
        initialConversation?.let {
            onOpenConversation(it)
            onInitialConversationHandled()
        }
    }
    LaunchedEffect(groupInvitations) {
        if (groupInvitations) {
            onShowGroupInvitations()
            onGroupInvitationsHandled()
        }
    }
    LaunchedEffect(channelInvitations) {
        if (channelInvitations) {
            onShowChannelInvitations()
            onChannelInvitationsHandled()
        }
    }
    LoadNotificationConversation(
        repository = repository,
        executor = executor,
        conversationId = conversationId,
        onHandled = onConversationHandled,
        onOpen = onOpenConversation,
        onAuthenticationRequired = onReauthenticate,
        onFailure = onConversationFailure,
    )
}

@Composable
internal fun MessagesNotificationTargetError(message: String?, onDismiss: () -> Unit) {
    if (message == null) return
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(message, Modifier.weight(1f), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        TextButton(onClick = onDismiss) { Text("Dismiss") }
    }
}

@Composable
internal fun MessagesStoriesTrayItem(
    result: StoryTrayResult?,
    folder: MessagesInboxFolder,
    myAvatarUrl: String?,
    onStorySelected: (String) -> Unit,
    onAddStory: () -> Unit,
    onRetry: () -> Unit,
    onReauthenticate: () -> Unit,
) {
    Column {
        StoriesTray(
            entries = (result as? StoryTrayResult.Success)?.entries.orEmpty(),
            onStorySelected = onStorySelected,
            myAvatarUrl = myAvatarUrl,
            onAddStory = onAddStory,
            modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
        )
        when (result) {
            is StoryTrayResult.Success -> Unit
            is StoryTrayResult.Failure -> if (result.authenticationRequired) {
                TextButton(onClick = onReauthenticate, modifier = Modifier.fillMaxWidth()) { Text("Sign in to view stories") }
            } else {
                TextButton(onClick = onRetry, modifier = Modifier.fillMaxWidth()) { Text("Stories unavailable · Retry") }
            }
            null -> if (folder == MessagesInboxFolder.CHATS) {
                Box(Modifier.fillMaxWidth().padding(14.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                }
            }
        }
    }
}
