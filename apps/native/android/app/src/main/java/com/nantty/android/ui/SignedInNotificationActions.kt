package com.nantty.android.ui

import com.nantty.android.data.InboxConversation

internal data class MainContentNotificationActions(
    val openConversation: (InboxConversation) -> Unit = {},
    val openOrders: () -> Unit = {},
    val openOrder: (String) -> Unit = {},
    val openFollowRequests: () -> Unit = {},
    val openSpaces: () -> Unit = {},
    val openGroupInvitations: () -> Unit = {},
    val openSupportTicket: (String) -> Unit = {},
    val openDispute: (String) -> Unit = {},
    val openClip: (String) -> Unit = {},
)

internal fun signedInNotificationActions(
    isGuest: Boolean,
    onRequireSignIn: () -> Unit,
    onSelectDestination: (Destination) -> Unit,
    onSetPendingConversation: (InboxConversation) -> Unit,
    onQueueGroupInvitations: () -> Unit,
    onOpenSpaces: () -> Unit = {},
    onQueueSupportTicket: (String) -> Unit,
    onQueueDispute: (String) -> Unit,
    onQueueClip: (String) -> Unit,
    onQueueOrder: (String) -> Unit = {},
) = MainContentNotificationActions(
    openConversation = { conversation ->
        if (isGuest) onRequireSignIn()
        else {
            onSetPendingConversation(conversation)
            onSelectDestination(Destination.Messages)
        }
    },
    openOrders = { if (isGuest) onRequireSignIn() else onSelectDestination(Destination.Orders) },
    openOrder = { orderId ->
        if (isGuest) onRequireSignIn()
        else {
            onQueueOrder(orderId)
            onSelectDestination(Destination.Orders)
        }
    },
    openFollowRequests = { if (isGuest) onRequireSignIn() else onSelectDestination(Destination.FollowRequests) },
    openSpaces = { if (isGuest) onRequireSignIn() else onSelectDestination(Destination.Spaces) },
    openGroupInvitations = {
        if (isGuest) onRequireSignIn()
        else {
            onQueueGroupInvitations()
            onSelectDestination(Destination.Messages)
        }
    },
    openSupportTicket = { ticketId ->
        if (isGuest) onRequireSignIn()
        else {
            onQueueSupportTicket(ticketId)
            onSelectDestination(Destination.SupportRequests)
        }
    },
    openDispute = { disputeId ->
        if (isGuest) onRequireSignIn()
        else {
            onQueueDispute(disputeId)
            onSelectDestination(Destination.DisputeDetail)
        }
    },
    openClip = { clipId ->
        onQueueClip(clipId)
        onSelectDestination(Destination.Clips)
    },
)
