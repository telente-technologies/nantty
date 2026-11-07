package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.nantty.android.data.ChatStreak
import kotlinx.coroutines.delay

/** UI-only status supplied by the chat/key-management owner. This component makes no crypto claim. */
enum class SecureChatStatus { NOT_PROVIDED, CHECKING, AVAILABLE, UNAVAILABLE }

enum class ConversationKeyTrustState { NOT_PROVIDED, CHECKING, TRUSTED, CHANGED, UNAVAILABLE }

enum class ConversationTimelineState { LOADING, READY, EMPTY, ERROR }

enum class ConversationMessageState { READY, DECRYPTION_ERROR }

data class ConversationTimelineItem(
    val id: String,
    val author: String,
    /** Already display-safe text from the caller. Never pass ciphertext here. */
    val displayText: String?,
    val timeLabel: String,
    val isOutgoing: Boolean,
    val state: ConversationMessageState = ConversationMessageState.READY,
    /** A user-facing decryption error, separate from content and ciphertext. */
    val errorLabel: String? = null,
    val retryable: Boolean = false,
)

data class ConversationComposerState(
    val draft: String,
    val enabled: Boolean,
    val sendEnabled: Boolean,
    val sending: Boolean = false,
)

/**
 * Reusable conversation-thread presentation. All data, security assertions, loading/error state,
 * and actions are injected by the host. No network, persistence, or cryptographic work is done here.
 */
@Composable
fun ConversationThreadScreen(
    peerName: String,
    subtitle: String?,
    timeline: List<ConversationTimelineItem>,
    targetMessageId: String? = null,
    timelineState: ConversationTimelineState,
    timelineError: String?,
    statusMessage: String? = null,
    composer: ConversationComposerState,
    secureChatStatus: SecureChatStatus,
    secureChatStatusLabel: String?,
    keyTrustState: ConversationKeyTrustState,
    keyTrustStatusLabel: String?,
    safetyCodeAvailable: Boolean,
    safetyCodeLabel: String?,
    retryingMessageIds: Set<String>,
    hasOlderMessages: Boolean = false,
    loadingOlderMessages: Boolean = false,
    olderMessagesError: String? = null,
    allowMarkRead: Boolean = true,
    modifier: Modifier = Modifier,
    onBack: () -> Unit,
    onOpenPeerOrInfo: () -> Unit,
    onOpenSafetyCode: () -> Unit,
    onMarkRead: () -> Unit,
    onRefresh: () -> Unit,
    onDraftChange: (String) -> Unit,
    onSendText: (String) -> Unit,
    onRetryMessage: (String) -> Unit,
    onLoadOlderMessages: () -> Unit = {},
    streak: ChatStreak? = null,
    streakRestorePending: Boolean = false,
    streakRestoreError: String? = null,
    streakRestoreCelebration: Boolean = false,
    onRestoreStreak: () -> Unit = {},
    onDismissStreakRestoreCelebration: () -> Unit = {},
    onAcknowledgeStreakCelebration: () -> Unit = {},
) {
    var safetyCodeDialogOpen by remember { mutableStateOf(false) }
    var streakDialogOpen by remember { mutableStateOf(false) }
    var milestoneCelebrationDismissed by remember(streak?.milestoneDays) { mutableStateOf(false) }
    var highlightedMessageId by remember(targetMessageId) { mutableStateOf<String?>(null) }
    val safeItems = remember(timeline) { timeline.filterNot { it.state == ConversationMessageState.READY && it.displayText == null } }
    val messageListState = rememberLazyListState()

    LaunchedEffect(targetMessageId, safeItems) {
        val targetId = targetMessageId ?: return@LaunchedEffect
        val targetIndex = safeItems.indexOfFirst { it.id == targetId }
        if (targetIndex >= 0) {
            messageListState.animateScrollToItem(targetIndex)
            highlightedMessageId = targetId
            delay(3_500)
            if (highlightedMessageId == targetId) highlightedMessageId = null
        }
    }

    if (safetyCodeDialogOpen) {
        AlertDialog(
            onDismissRequest = { safetyCodeDialogOpen = false },
            title = { Text("Safety code") },
            text = { Text(safetyCodeLabel ?: "Safety code is not available.") },
            confirmButton = { TextButton(onClick = { safetyCodeDialogOpen = false }) { Text("Close") } },
        )
    }

    if (streakDialogOpen && streak != null) {
        ConversationStreakDialog(
            peerName = peerName,
            streak = streak,
            restorePending = streakRestorePending,
            restoreError = streakRestoreError,
            onRestore = onRestoreStreak,
            onDismiss = { streakDialogOpen = false },
        )
    }

    if (streakRestoreCelebration && streak != null) {
        ConversationStreakCelebration(
            peerName = peerName,
            days = streak.count,
            restored = true,
            onDismiss = onDismissStreakRestoreCelebration,
        )
    } else if (streak?.milestoneCelebrationPending == true && !milestoneCelebrationDismissed) {
        ConversationStreakCelebration(
            peerName = peerName,
            days = streak.milestoneDays ?: streak.countBeforeBreak,
            onDismiss = {
                milestoneCelebrationDismissed = true
                onAcknowledgeStreakCelebration()
            },
        )
    }

    Column(modifier.fillMaxSize().imePadding()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to messages" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Column(
                Modifier.weight(1f).semantics(mergeDescendants = true) { contentDescription = "Conversation with $peerName" }
                    .padding(start = 4.dp, top = 4.dp, bottom = 4.dp),
            ) {
                Text(peerName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 2)
                subtitle?.takeIf(String::isNotBlank)?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2)
                }
            }
            IconButton(onClick = onOpenPeerOrInfo, modifier = Modifier.semantics { contentDescription = "Conversation info" }) {
                Icon(Icons.Outlined.Info, contentDescription = null)
            }
            streak?.takeIf { it.state != "none" }?.let { currentStreak ->
                TextButton(onClick = { streakDialogOpen = true }, modifier = Modifier.semantics {
                    contentDescription = when {
                        currentStreak.state == "broken" -> "Restore streak with $peerName"
                        currentStreak.hourglass -> "${currentStreak.count} day streak ending soon"
                        else -> "${currentStreak.count} day streak"
                    }
                }) {
                    Text(when {
                        currentStreak.state == "broken" -> "Restore"
                        else -> "${currentStreak.count}d"
                    }, maxLines = 1)
                }
            }
            if (allowMarkRead) IconButton(onClick = onMarkRead, modifier = Modifier.semantics { contentDescription = "Mark conversation as read" }) {
                Icon(Icons.Default.DoneAll, contentDescription = null)
            }
            IconButton(onClick = onRefresh, modifier = Modifier.semantics { contentDescription = "Refresh conversation" }) {
                Icon(Icons.Default.Refresh, contentDescription = null)
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        SecurityStatusBanner(
            secureChatStatus,
            secureChatStatusLabel,
            keyTrustState,
            keyTrustStatusLabel,
            safetyCodeAvailable,
            onOpenSafetyCode,
        ) {
            safetyCodeDialogOpen = true
        }
        statusMessage?.takeIf(String::isNotBlank)?.let {
            Text(
                it,
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            when (timelineState) {
                ConversationTimelineState.LOADING -> CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading conversation" })
                ConversationTimelineState.EMPTY -> StateMessage(
                    title = "No messages yet",
                    detail = "Messages will appear here when they are available.",
                    actionLabel = "Refresh",
                    onAction = onRefresh,
                )
                ConversationTimelineState.ERROR -> StateMessage(
                    title = "Conversation could not load",
                    detail = timelineError ?: "Try again when you’re back online.",
                    actionLabel = "Try again",
                    onAction = onRefresh,
                )
                ConversationTimelineState.READY -> Column(Modifier.fillMaxSize()) {
                    if (hasOlderMessages || loadingOlderMessages) {
                        TextButton(
                            onClick = onLoadOlderMessages,
                            enabled = !loadingOlderMessages,
                            modifier = Modifier.align(Alignment.CenterHorizontally),
                        ) {
                            Text(if (loadingOlderMessages) "Loading older messages" else "Load older messages")
                        }
                    }
                    olderMessagesError?.takeIf(String::isNotBlank)?.let {
                        Text(
                            it,
                            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    if (safeItems.isEmpty()) {
                        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                            StateMessage("No displayable messages", "Encrypted or unavailable content is not shown as plaintext.")
                        }
                    } else {
                        LazyColumn(
                            Modifier.weight(1f).widthIn(max = 900.dp).fillMaxWidth().align(Alignment.CenterHorizontally),
                            state = messageListState,
                            reverseLayout = true,
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            // The API returns newest-first; reverseLayout anchors the newest row at
                            // the bottom without reversing the chronology a second time.
                            items(safeItems, key = ConversationTimelineItem::id) { item ->
                                MessageBubble(item, retryingMessageIds.contains(item.id), onRetryMessage, item.id == highlightedMessageId)
                            }
                        }
                    }
                }
            }
        }

        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedTextField(
                value = composer.draft,
                onValueChange = onDraftChange,
                modifier = Modifier.weight(1f),
                enabled = composer.enabled && !composer.sending,
                label = { Text("Message") },
                placeholder = { Text("Write a message") },
                minLines = 1,
                maxLines = 5,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = {
                    if (composer.enabled && composer.sendEnabled && !composer.sending && composer.draft.isNotBlank()) {
                        onSendText(composer.draft.trim())
                    }
                }),
            )
            IconButton(
                onClick = { onSendText(composer.draft.trim()) },
                enabled = composer.enabled && composer.sendEnabled && !composer.sending && composer.draft.isNotBlank(),
                modifier = Modifier.semantics { contentDescription = if (composer.sending) "Sending message" else "Send message" },
            ) {
                if (composer.sending) CircularProgressIndicator()
                else Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null)
            }
        }
    }
}
@Composable
private fun SecurityStatusBanner(
    secureChatStatus: SecureChatStatus,
    secureChatLabel: String?,
    keyTrustState: ConversationKeyTrustState,
    keyTrustLabel: String?,
    safetyCodeAvailable: Boolean,
    onOpenSafetyCode: () -> Unit,
    onShowSafetyCode: () -> Unit,
) {
    val secureStatus = secureChatLabel?.takeIf(String::isNotBlank) ?: when (secureChatStatus) {
        SecureChatStatus.NOT_PROVIDED -> "Secure-chat status not provided"
        SecureChatStatus.CHECKING -> "Checking secure-chat status"
        SecureChatStatus.AVAILABLE -> "Secure-chat status available"
        SecureChatStatus.UNAVAILABLE -> "Secure-chat status unavailable"
    }
    val trustStatus = keyTrustLabel?.takeIf(String::isNotBlank) ?: when (keyTrustState) {
        ConversationKeyTrustState.NOT_PROVIDED -> "Key trust not provided"
        ConversationKeyTrustState.CHECKING -> "Checking key trust"
        ConversationKeyTrustState.TRUSTED -> "Key trust: trusted"
        ConversationKeyTrustState.CHANGED -> "Key trust needs review"
        ConversationKeyTrustState.UNAVAILABLE -> "Key trust unavailable"
    }
    Surface(color = MaterialTheme.colorScheme.surfaceContainerLow) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(Icons.Outlined.Security, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Column(Modifier.weight(1f)) {
                Text(secureStatus, style = MaterialTheme.typography.bodyMedium)
                Text(trustStatus, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (safetyCodeAvailable) {
                TextButton(onClick = {
                    onOpenSafetyCode()
                    onShowSafetyCode()
                }) { Text("View safety code") }
            }
        }
    }
}

@Composable
private fun MessageBubble(item: ConversationTimelineItem, retrying: Boolean, onRetry: (String) -> Unit, highlighted: Boolean = false) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        horizontalArrangement = if (item.isOutgoing) Arrangement.End else Arrangement.Start,
    ) {
        Surface(
            modifier = Modifier.widthIn(max = 680.dp),
            shape = RoundedCornerShape(20.dp),
            color = if (highlighted) MaterialTheme.colorScheme.tertiaryContainer
            else if (item.isOutgoing) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainerHigh,
        ) {
            Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                if (highlighted) Text(
                    "Opened from notification",
                    Modifier.semantics { contentDescription = "Target message from notification" },
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                )
                if (item.author.isNotBlank()) Text(item.author, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (item.state == ConversationMessageState.DECRYPTION_ERROR) {
                    Text(item.errorLabel ?: "This message couldn’t be displayed securely.", style = MaterialTheme.typography.bodyLarge)
                    if (item.retryable) TextButton(
                        onClick = { onRetry(item.id) },
                        enabled = !retrying,
                        modifier = Modifier.semantics {
                            contentDescription = if (retrying) "Retrying message" else "Retry message"
                        },
                    ) {
                        if (retrying) CircularProgressIndicator() else Text("Try again")
                    }
                } else {
                    // displayText is the only renderable message content; no ciphertext fallback exists.
                    item.displayText?.let { Text(it, style = MaterialTheme.typography.bodyLarge) }
                }
                Text(item.timeLabel, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun StateMessage(title: String, detail: String, actionLabel: String? = null, onAction: (() -> Unit)? = null) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        Text(detail, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (actionLabel != null && onAction != null) TextButton(onClick = onAction) { Text(actionLabel) }
    }
}
