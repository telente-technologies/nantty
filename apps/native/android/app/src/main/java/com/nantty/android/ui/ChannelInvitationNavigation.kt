package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.runtime.setValue
import com.nantty.android.data.ChannelInvitation
import com.nantty.android.data.ConversationLookupResult
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesRepository
import java.util.concurrent.Executor

/** Owns one-shot channel invite deep-link delivery to the messages destination. */
@Composable
internal fun rememberChannelInvitationNavigation(
    requestedToken: String?,
    onHandled: () -> Unit,
    onOpenMessages: () -> Unit,
): ChannelInvitationNavigationState {
    var pendingToken by rememberSaveable { mutableStateOf<String?>(null) }
    LaunchedEffect(requestedToken) {
        requestedToken?.let {
            pendingToken = it
            onOpenMessages()
            onHandled()
        }
    }
    return remember { ChannelInvitationNavigationState({ pendingToken }, { pendingToken = null }, { pendingToken = it }) }
}

internal class ChannelInvitationNavigationState(
    private val readToken: () -> String?,
    private val clearToken: () -> Unit,
    private val writeToken: (String) -> Unit,
) {
    val token: String? get() = readToken()
    fun consume() = clearToken()
    fun open(token: String) = writeToken(token)
}

internal fun channelAcceptanceHandler(
    repository: MessagesRepository,
    executor: Executor,
    onOpened: (InboxConversation) -> Unit,
    onFailure: (message: String, authenticationRequired: Boolean) -> Unit,
): (ChannelInvitation) -> Unit = { invitation ->
    openAcceptedChannelConversation(invitation, repository, executor, onOpened, onFailure)
}

internal fun openAcceptedChannelConversation(
    invitation: ChannelInvitation,
    repository: MessagesRepository,
    executor: Executor,
    onOpened: (InboxConversation) -> Unit,
    onFailure: (message: String, authenticationRequired: Boolean) -> Unit,
) {
    executor.execute {
        when (val result = repository.loadConversationById(invitation.channelId)) {
            is ConversationLookupResult.Success -> Snapshot.withMutableSnapshot { onOpened(result.conversation) }
            is ConversationLookupResult.Failure -> Snapshot.withMutableSnapshot {
                onFailure(result.message, result.authenticationRequired)
            }
        }
    }
}
