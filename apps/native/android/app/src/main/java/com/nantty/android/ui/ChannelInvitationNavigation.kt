package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue

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
