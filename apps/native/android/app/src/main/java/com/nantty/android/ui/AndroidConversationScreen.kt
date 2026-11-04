package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import com.nantty.android.data.ChatHistoryResult
import com.nantty.android.data.EncryptedChatMessage
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesRepository
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.concurrent.Executor

/**
 * Loads an authenticated message timeline, but intentionally does not expose its encrypted
 * envelopes to Compose text. The Android client has no compatible crypto implementation yet.
 */
@Composable
internal fun AndroidConversationScreen(
    conversation: InboxConversation,
    repository: MessagesRepository,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    onConversationRead: () -> Unit = {},
) {
    var result by remember(repository, conversation.id) { mutableStateOf<ChatHistoryResult?>(null) }
    var refreshing by remember(repository, conversation.id) { mutableStateOf(false) }
    var readError by remember(repository, conversation.id) { mutableStateOf<String?>(null) }
    var showingInfo by remember(repository, conversation.id) { mutableStateOf(false) }

    fun refresh() {
        if (refreshing) return
        refreshing = true
        result = null
        executor.execute {
            val loaded = repository.loadMessages(conversation.id)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                result = loaded
                refreshing = false
            }
            if (loaded is ChatHistoryResult.Success) {
                repository.markConversationRead(conversation.id).onSuccess {
                    onConversationRead()
                }.onFailure { error ->
                    androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                        readError = error.message ?: "Could not update read status."
                    }
                }
            }
        }
    }

    fun markRead() {
        readError = null
        executor.execute {
            repository.markConversationRead(conversation.id).onSuccess {
                onConversationRead()
            }.onFailure { error ->
                androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    readError = error.message ?: "Could not update read status."
                }
            }
        }
    }

    LaunchedEffect(repository, conversation.id) { refresh() }

    val current = result
    val messages = (current as? ChatHistoryResult.Success)?.page?.messages.orEmpty()
    val timeline = remember(messages) { messages.map(::unavailableTimelineItem) }
    val authFailure = (current as? ChatHistoryResult.Failure)?.authenticationRequired == true
    val timelineState = when {
        current == null -> ConversationTimelineState.LOADING
        current is ChatHistoryResult.Failure -> ConversationTimelineState.ERROR
        messages.isEmpty() -> ConversationTimelineState.EMPTY
        else -> ConversationTimelineState.READY
    }

    ConversationThreadScreen(
        peerName = conversation.title,
        subtitle = when (conversation.type) {
            com.nantty.android.data.ConversationType.DIRECT -> "Direct message"
            else -> conversation.type.label
        },
        timeline = timeline,
        timelineState = timelineState,
        timelineError = (current as? ChatHistoryResult.Failure)?.message,
        statusMessage = readError,
        composer = ConversationComposerState(draft = "", enabled = false, sendEnabled = false),
        secureChatStatus = SecureChatStatus.UNAVAILABLE,
        secureChatStatusLabel = "Secure message decryption isn’t available in this Android build yet",
        keyTrustState = ConversationKeyTrustState.UNAVAILABLE,
        keyTrustStatusLabel = "Device-key verification isn’t available in this Android build",
        safetyCodeAvailable = false,
        safetyCodeLabel = null,
        retryingMessageIds = emptySet(),
        onBack = onBack,
        onOpenPeerOrInfo = { showingInfo = true },
        onOpenSafetyCode = {},
        onMarkRead = ::markRead,
        onRefresh = { if (authFailure) onReauthenticate() else refresh() },
        onDraftChange = {},
        onSendText = {},
        onRetryMessage = {},
    )
    if (showingInfo) AlertDialog(
        onDismissRequest = { showingInfo = false },
        title = { Text(conversation.title) },
        text = { Text("${conversation.type.label}. Conversation management and member details are not available in this Android messaging build yet.") },
        confirmButton = { TextButton(onClick = { showingInfo = false }) { Text("Close") } },
    )
}

private fun unavailableTimelineItem(message: EncryptedChatMessage) = ConversationTimelineItem(
    id = message.id,
    author = "",
    displayText = null,
    timeLabel = runCatching {
        DateTimeFormatter.ofPattern("h:mm a").format(Instant.parse(message.createdAt).atZone(ZoneId.systemDefault()))
    }.getOrDefault(""),
    isOutgoing = false,
    state = ConversationMessageState.DECRYPTION_ERROR,
    errorLabel = when {
        message.moderationHidden -> "This message is unavailable."
        message.ciphertext.isNullOrBlank() -> "This message has no readable secure envelope."
        else -> "Encrypted message. Secure decryption is not available in this Android build yet."
    },
    retryable = false,
)
