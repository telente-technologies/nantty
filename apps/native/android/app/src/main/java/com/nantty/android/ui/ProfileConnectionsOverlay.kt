package com.nantty.android.ui

import androidx.compose.runtime.Composable
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.PublicProfileRepository
import java.util.concurrent.Executor

@Composable
internal fun ProfileConnectionsOverlay(
    userId: String,
    initialTab: String,
    repository: PublicProfileRepository,
    executor: Executor,
    messagesRepository: MessagesRepository,
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit,
    onRequireSignIn: () -> Unit,
    onOpenConversation: (InboxConversation) -> Unit,
) {
    ProfileConnectionsDestination(
        userId = userId,
        initialTab = initialTab,
        repository = repository,
        executor = executor,
        onBack = onBack,
        onOpenProfile = onOpenProfile,
        onRequireSignIn = onRequireSignIn,
        messagesRepository = messagesRepository,
        onOpenConversation = onOpenConversation,
    )
}
