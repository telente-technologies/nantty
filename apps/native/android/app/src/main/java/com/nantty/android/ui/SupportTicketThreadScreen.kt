package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.SupportTicketDetail
import com.nantty.android.data.SupportTicketRepository
import com.nantty.android.data.SupportTicketResult
import java.util.UUID
import java.util.concurrent.Executor
import kotlinx.coroutines.delay

@Composable
internal fun SupportTicketThreadScreen(
    ticketId: String,
    repository: SupportTicketRepository,
    executor: Executor,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var detail by remember(ticketId) { mutableStateOf<SupportTicketDetail?>(null) }
    var loading by remember(ticketId) { mutableStateOf(true) }
    var loadError by remember(ticketId) { mutableStateOf<String?>(null) }
    var draft by remember(ticketId) { mutableStateOf("") }
    var submitting by remember(ticketId) { mutableStateOf(false) }
    var ratingSubmitting by remember(ticketId) { mutableStateOf(false) }
    var ratingError by remember(ticketId) { mutableStateOf<String?>(null) }
    var sendError by remember(ticketId) { mutableStateOf<String?>(null) }
    var refreshGeneration by remember(ticketId) { mutableIntStateOf(0) }
    var generation by remember(ticketId) { mutableIntStateOf(0) }
    var markedUnreadCount by remember(ticketId) { mutableIntStateOf(0) }

    BackHandler(onBack = onBack)

    fun refresh() {
        val request = ++generation
        executor.execute {
            val result = repository.loadTicket(ticketId)
            Snapshot.withMutableSnapshot {
                if (generation == request) {
                    when (result) {
                        is SupportTicketResult.Success -> {
                            detail = result.value
                            loadError = null
                        }
                        is SupportTicketResult.Failure -> {
                            loadError = result.message
                            if (result.authenticationRequired) onAuthenticationRequired()
                        }
                    }
                    loading = false
                }
            }
        }
    }

    LaunchedEffect(ticketId, refreshGeneration) { refresh() }
    LaunchedEffect(ticketId) {
        while (true) {
            delay(SUPPORT_POLL_INTERVAL_MS)
            if (detail != null && !loading) refresh()
        }
    }
    val unreadCount = detail?.unreadCount ?: 0
    LaunchedEffect(ticketId, unreadCount) {
        if (unreadCount > 0 && markedUnreadCount != unreadCount) {
            markedUnreadCount = unreadCount
            executor.execute { repository.markRead(ticketId) }
        }
    }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
            Text("Support", Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            TextButton(onClick = { refreshGeneration++ }, modifier = Modifier.padding(start = 8.dp)) { Text("Refresh") }
        }

        when {
            loading && detail == null -> Column(
                Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                CircularProgressIndicator()
                Text("Loading support request", Modifier.padding(top = 12.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            detail == null -> Column(
                Modifier.fillMaxSize().padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(loadError ?: "Couldn't load this support request.", color = MaterialTheme.colorScheme.error)
                if (loadError?.contains("Sign in", ignoreCase = true) == true) {
                    TextButton(onClick = onAuthenticationRequired) { Text("Sign in again") }
                } else {
                    TextButton(onClick = { refreshGeneration++ }) { Text("Try again") }
                }
            }
            else -> SupportTicketThreadContent(
                detail = detail!!,
                draft = draft,
                onDraftChange = { draft = it.take(MAX_SUPPORT_REPLY_LENGTH); sendError = null },
                isSubmitting = submitting,
                sendError = sendError,
                canReply = detail!!.canReply && detail!!.status != "closed",
                isRating = ratingSubmitting,
                ratingError = ratingError,
                onRate = { score ->
                    if (!ratingSubmitting) {
                        ratingSubmitting = true
                        ratingError = null
                        executor.execute {
                            val result = repository.rateTicket(ticketId, score)
                            Snapshot.withMutableSnapshot {
                                ratingSubmitting = false
                                when (result) {
                                    is SupportTicketResult.Success -> refreshGeneration++
                                    is SupportTicketResult.Failure -> {
                                        ratingError = result.message
                                        if (result.authenticationRequired) onAuthenticationRequired()
                                    }
                                }
                            }
                        }
                    }
                },
                onReply = {
                    if (submitting) return@SupportTicketThreadContent
                    val replyText = draft.trim()
                    if (replyText.isEmpty() || replyText.length > MAX_SUPPORT_REPLY_LENGTH) {
                        sendError = "Write a reply before sending."
                    } else {
                        submitting = true
                        sendError = null
                        val key = UUID.randomUUID().toString()
                        executor.execute {
                            val result = repository.reply(ticketId, replyText, key)
                            Snapshot.withMutableSnapshot {
                                submitting = false
                                when (result) {
                                    is SupportTicketResult.Success -> {
                                        draft = ""
                                        refreshGeneration++
                                    }
                                    is SupportTicketResult.Failure -> {
                                        sendError = result.message
                                        if (result.authenticationRequired) onAuthenticationRequired()
                                    }
                                }
                            }
                        }
                    }
                },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun SupportTicketThreadContent(
    detail: SupportTicketDetail,
    draft: String,
    onDraftChange: (String) -> Unit,
    isSubmitting: Boolean,
    sendError: String?,
    canReply: Boolean,
    isRating: Boolean,
    ratingError: String?,
    onRate: (Int) -> Unit,
    onReply: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier) {
        LazyColumn(
            Modifier.weight(1f).fillMaxWidth(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(detail.subject, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    Text(supportTicketStatusLabel(detail.status), color = MaterialTheme.colorScheme.primary)
                    detail.reference?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    detail.linkedReference?.let {
                        Text("Linked to ${it.label}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            item {
                Text(
                    "This support conversation may be recorded for quality and safety. It is not end-to-end encrypted.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (detail.canRate && detail.satisfactionScore == null) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("How was your support experience?", style = MaterialTheme.typography.titleSmall)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            (1..5).forEach { score ->
                                TextButton(
                                    enabled = !isRating,
                                    onClick = { onRate(score) },
                                    modifier = Modifier.semantics { contentDescription = "Rate support $score out of 5" },
                                ) { Text(score.toString()) }
                            }
                        }
                        ratingError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                        if (isRating) CircularProgressIndicator()
                    }
                }
            }
            detail.satisfactionScore?.let { score ->
                item { Text("You rated this $score out of 5. Thank you.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            items(detail.messages, key = { it.id }) { message ->
                Column(
                    Modifier.fillMaxWidth(),
                    horizontalAlignment = if (message.fromSupport) Alignment.Start else Alignment.End,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(message.authorName, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        message.text,
                        Modifier.padding(horizontal = 4.dp),
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Text(message.createdAt, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            if (detail.agentTyping) item { Text("Nantty Support is typing…", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            if (!canReply) item { Text("This request is closed. Contact support again if you still need help.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        if (canReply) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = draft,
                    onValueChange = onDraftChange,
                    label = { Text("Reply to support") },
                    placeholder = { Text("Message Nantty Support…") },
                    enabled = !isSubmitting,
                    maxLines = 5,
                    modifier = Modifier.fillMaxWidth(),
                    supportingText = { Text("${draft.length}/$MAX_SUPPORT_REPLY_LENGTH") },
                )
                sendError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                Button(onClick = onReply, enabled = !isSubmitting && draft.isNotBlank(), modifier = Modifier.fillMaxWidth()) {
                    Text(if (isSubmitting) "Sending…" else "Send reply")
                }
            }
        }
    }
}

internal fun supportTicketStatusLabel(status: String): String = when (status) {
    "awaiting_you" -> "Needs your reply"
    "awaiting_support" -> "Waiting for support"
    "resolved" -> "Resolved"
    "closed" -> "Closed"
    else -> "Open"
}

private const val MAX_SUPPORT_REPLY_LENGTH = 5_000
private const val SUPPORT_POLL_INTERVAL_MS = 3_000L
