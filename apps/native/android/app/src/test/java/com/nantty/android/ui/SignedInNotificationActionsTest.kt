package com.nantty.android.ui

import com.nantty.android.data.ConversationType
import com.nantty.android.data.InboxConversation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SignedInNotificationActionsTest {
    @Test
    fun notificationActionsQueueTargetsAndNavigateForSignedInUser() {
        var destination: Destination? = null
        var conversation: InboxConversation? = null
        var invitationsQueued = false
        var supportTicketId: String? = null
        var clipId: String? = null
        var disputeId: String? = null
        var signInRequested = false
        val actions = signedInNotificationActions(
            isGuest = false,
            onRequireSignIn = { signInRequested = true },
            onSelectDestination = { destination = it },
            onSetPendingConversation = { conversation = it },
            onQueueGroupInvitations = { invitationsQueued = true },
            onQueueSupportTicket = { supportTicketId = it },
            onQueueDispute = { disputeId = it },
            onQueueClip = { clipId = it },
        )
        val targetConversation = InboxConversation(
            id = "conversation-1", title = "Ari", peerName = "ari", avatarUrl = null,
            type = ConversationType.DIRECT, lastMessageAt = "now", unreadCount = 0,
        )

        actions.openConversation(targetConversation)
        assertEquals(targetConversation, conversation)
        assertEquals(Destination.Messages, destination)
        actions.openGroupInvitations()
        assertTrue(invitationsQueued)
        assertEquals(Destination.Messages, destination)
        actions.openSupportTicket("ticket-1")
        assertEquals("ticket-1", supportTicketId)
        assertEquals(Destination.SupportRequests, destination)
        actions.openDispute("7b9e2f3a-1111-4222-8333-123456789abc")
        assertEquals("7b9e2f3a-1111-4222-8333-123456789abc", disputeId)
        assertEquals(Destination.DisputeDetail, destination)
        actions.openClip("clip-1")
        assertEquals("clip-1", clipId)
        assertEquals(Destination.Clips, destination)
        actions.openOrders()
        assertEquals(Destination.Orders, destination)
        actions.openFollowRequests()
        assertEquals(Destination.FollowRequests, destination)
        actions.openSpaces()
        assertEquals(Destination.Spaces, destination)
        assertFalse(signInRequested)
    }

    @Test
    fun protectedNotificationActionsRequireSignInForGuests() {
        var destination: Destination? = null
        var signInRequests = 0
        var conversationQueued = false
        val actions = signedInNotificationActions(
            isGuest = true,
            onRequireSignIn = { signInRequests += 1 },
            onSelectDestination = { destination = it },
            onSetPendingConversation = { conversationQueued = true },
            onQueueGroupInvitations = {},
            onQueueSupportTicket = {},
            onQueueDispute = {},
            onQueueClip = {},
        )

        actions.openOrders()
        actions.openFollowRequests()
        actions.openSpaces()
        actions.openGroupInvitations()
        actions.openSupportTicket("ticket-1")
        actions.openDispute("7b9e2f3a-1111-4222-8333-123456789abc")
        actions.openConversation(
            InboxConversation("conversation-1", "Ari", "ari", null, ConversationType.DIRECT, "now", 0),
        )

        assertEquals(7, signInRequests)
        assertEquals(null, destination)
        assertFalse(conversationQueued)
    }
}
