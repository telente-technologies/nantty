package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.nantty.android.data.InboxConversation
import com.nantty.android.data.MessagesRepository
import com.nantty.android.data.StoriesRepository
import com.nantty.android.data.StoryAdsRepository
import com.nantty.android.data.StoryAdDestination
import com.nantty.android.data.LiveSessionsRepository
import java.util.concurrent.Executor

/** Keeps the inbox route wiring outside the cross-feature destination switch. */
@Composable
internal fun MessagesDestination(
    repository: MessagesRepository,
    executor: Executor,
    modifier: Modifier,
    onReauthenticate: () -> Unit,
    initialConversation: InboxConversation?,
    onInitialConversationHandled: () -> Unit,
    initialNotificationConversationId: String?,
    onInitialNotificationConversationHandled: () -> Unit,
    initialGroupInvitations: Boolean,
    onInitialGroupInvitationsHandled: () -> Unit,
    initialChannelInvitations: Boolean,
    onInitialChannelInvitationsHandled: () -> Unit,
    initialGroupInvitationToken: String?,
    onInitialGroupInvitationTokenHandled: () -> Unit,
    initialChannelInvitationToken: String?,
    onInitialChannelInvitationTokenHandled: () -> Unit,
    onOpenChatNotificationSettings: () -> Unit,
    externalRefreshGeneration: Int,
    storiesRepository: StoriesRepository?,
    storyAdsRepository: StoryAdsRepository?,
    liveSessionsRepository: LiveSessionsRepository?,
    onOpenLive: (String) -> Unit,
    onOpenStoryAdDestination: (StoryAdDestination) -> Unit,
    currentUserAvatarUrl: String?,
    onAddStory: () -> Unit,
) {
    MessagesScreen(
        repository = repository,
        executor = executor,
        modifier = modifier,
        onReauthenticate = onReauthenticate,
        initialConversation = initialConversation,
        onInitialConversationHandled = onInitialConversationHandled,
        initialNotificationConversationId = initialNotificationConversationId,
        onInitialNotificationConversationHandled = onInitialNotificationConversationHandled,
        initialGroupInvitations = initialGroupInvitations,
        onInitialGroupInvitationsHandled = onInitialGroupInvitationsHandled,
        initialChannelInvitations = initialChannelInvitations,
        onInitialChannelInvitationsHandled = onInitialChannelInvitationsHandled,
        initialGroupInvitationToken = initialGroupInvitationToken,
        onInitialGroupInvitationTokenHandled = onInitialGroupInvitationTokenHandled,
        initialChannelInvitationToken = initialChannelInvitationToken,
        onInitialChannelInvitationTokenHandled = onInitialChannelInvitationTokenHandled,
        onOpenChatNotificationSettings = onOpenChatNotificationSettings,
        externalRefreshGeneration = externalRefreshGeneration,
        storiesRepository = storiesRepository,
        storyAdsRepository = storyAdsRepository,
        liveSessionsRepository = liveSessionsRepository,
        onOpenLive = onOpenLive,
        onOpenStoryAdDestination = onOpenStoryAdDestination,
        currentUserAvatarUrl = currentUserAvatarUrl,
        onAddStory = onAddStory,
    )
}
