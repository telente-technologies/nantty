package com.nantty.android.ui

import androidx.compose.runtime.Composable
import com.nantty.android.data.PublicProfileRepository
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.StoriesRepository
import java.util.concurrent.Executor

@Composable
internal fun PublicProfileDestination(
    userId: String,
    repository: PublicProfileRepository,
    storiesRepository: StoriesRepository,
    executor: Executor,
    onBack: () -> Unit,
    onOpenPost: (String) -> Unit,
    onSearchProfile: (String, String) -> Unit,
    onOpenConnections: (String, String) -> Unit,
    onReauthenticate: () -> Unit,
) {
    HingeSafeContent {
        PublicProfileScreen(
            userId = userId,
            repository = repository,
            storiesRepository = storiesRepository,
            executor = executor,
            onBack = onBack,
            onOpenPost = onOpenPost,
            onSearchProfile = onSearchProfile,
            onOpenConnections = onOpenConnections,
            onReauthenticate = onReauthenticate,
        )
    }
}

@Composable
internal fun ProfileConnectionsDestination(
    userId: String,
    initialTab: String,
    repository: PublicProfileRepository,
    executor: Executor,
    onBack: () -> Unit,
    onOpenProfile: (String) -> Unit,
    onRequireSignIn: () -> Unit,
    messagesRepository: MessagesRepository? = null,
    onOpenConversation: (InboxConversation) -> Unit = {},
) {
    HingeSafeContent {
        ProfileConnectionsScreen(
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
}
