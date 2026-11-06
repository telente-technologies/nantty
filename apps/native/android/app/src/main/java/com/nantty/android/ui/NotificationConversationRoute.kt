package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshots.Snapshot
import com.nantty.android.data.ConversationLookupResult
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesRepository
import java.util.concurrent.Executor
import java.util.concurrent.atomic.AtomicInteger

@Composable
internal fun LoadNotificationConversation(
    repository: MessagesRepository,
    executor: Executor,
    conversationId: String?,
    onHandled: () -> Unit,
    onOpen: (InboxConversation) -> Unit,
    onAuthenticationRequired: () -> Unit,
    onFailure: (String) -> Unit,
) {
    val generation = remember(repository) { AtomicInteger() }
    DisposableEffect(repository) {
        onDispose { generation.incrementAndGet() }
    }
    LaunchedEffect(repository, conversationId) {
        val id = conversationId ?: return@LaunchedEffect
        val request = generation.incrementAndGet()
        executor.execute {
            val outcome = repository.loadConversationById(id)
            if (generation.get() != request) return@execute
            Snapshot.withMutableSnapshot {
                when (outcome) {
                    is ConversationLookupResult.Success -> onOpen(outcome.conversation)
                    is ConversationLookupResult.Failure -> {
                        if (outcome.authenticationRequired) onAuthenticationRequired()
                        else onFailure(outcome.message)
                    }
                }
                onHandled()
            }
        }
    }
}
