package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import com.nantty.android.notifications.PushTapRoute
import com.nantty.android.notifications.PushTapTarget

@Composable
internal fun SignedInPushTargetEffect(
    target: PushTapTarget?,
    isGuest: Boolean,
    onRequireSignIn: () -> Unit,
    onHandled: () -> Unit,
    onOpenPost: (String, String?) -> Unit,
    onOpenProfile: (String) -> Unit,
    onOpenConversation: (String) -> Unit,
    onOpenOrder: (String?) -> Unit,
    onSelectDestination: (Destination) -> Unit,
    onOpenGroupInvitations: (String?) -> Unit,
    onOpenChannelInvitations: (String?) -> Unit,
    onOpenSupportTicket: (String) -> Unit,
    onOpenDispute: (String) -> Unit,
    onOpenClip: (String) -> Unit,
    onOpenLive: (String) -> Unit = {},
) {
    LaunchedEffect(target, isGuest) {
        val pushTarget = target ?: return@LaunchedEffect
        if (isGuest) {
            onRequireSignIn()
            return@LaunchedEffect
        }
        when (pushTarget.route) {
            PushTapRoute.POST -> pushTarget.id?.let { onOpenPost(it, pushTarget.secondaryId) }
            PushTapRoute.PROFILE -> pushTarget.id?.let(onOpenProfile)
            PushTapRoute.CONVERSATION -> pushTarget.id?.let(onOpenConversation)
            PushTapRoute.MESSAGES -> onSelectDestination(Destination.Messages)
            PushTapRoute.ORDERS -> onOpenOrder(pushTarget.id)
            PushTapRoute.FOLLOW_REQUESTS -> onSelectDestination(Destination.FollowRequests)
            PushTapRoute.SPACES -> onSelectDestination(Destination.Spaces)
            PushTapRoute.GROUP_INVITATIONS -> onOpenGroupInvitations(pushTarget.id)
            PushTapRoute.CHANNEL_INVITATIONS -> onOpenChannelInvitations(pushTarget.id)
            PushTapRoute.SUPPORT_TICKET -> pushTarget.id?.let(onOpenSupportTicket)
            PushTapRoute.DISPUTE -> pushTarget.id?.let(onOpenDispute)
            PushTapRoute.CLIP -> pushTarget.id?.let(onOpenClip)
            PushTapRoute.LIVE -> pushTarget.id?.let(onOpenLive)
        }
        onHandled()
    }
}
