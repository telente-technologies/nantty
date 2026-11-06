package com.nantty.android.notifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PushTapTargetTest {
    @Test
    fun routesPostCommentsAndConversationPayloadsToNativeTargets() {
        assertEquals(
            PushTapTarget(PushTapRoute.POST, "post-1", "comment-2"),
            resolvePushTapTarget(mapOf("postId" to "post-1", "commentId" to "comment-2")),
        )
        assertEquals(
            PushTapTarget(PushTapRoute.CONVERSATION, CONVERSATION_ID, MESSAGE_ID),
            resolvePushTapTarget(mapOf("conversationId" to CONVERSATION_ID, "messageId" to MESSAGE_ID)),
        )
    }

    @Test
    fun routesGroupAndChannelInvitationNoticesToTheirInvitationInboxes() {
        assertEquals(
            PushTapTarget(PushTapRoute.GROUP_INVITATIONS),
            resolvePushTapTarget(mapOf("screen" to "GroupInvitations", "url" to "/chats/invitations")),
        )
        assertEquals(
            PushTapTarget(PushTapRoute.CHANNEL_INVITATIONS),
            resolvePushTapTarget(mapOf("screen" to "ChannelInvitations", "url" to "/channels/invitations")),
        )
        assertEquals(
            PushTapTarget(PushTapRoute.SPACES),
            resolvePushTapTarget(mapOf("screen" to "SpaceInvitations", "url" to "/spaces", "spaceId" to "space-1", "invitationId" to "inv-1")),
        )
    }

    @Test
    fun keepsUnsupportedOrUntrustedTargetsOutOfNotificationIntents() {
        assertNull(resolvePushTapTarget(mapOf("url" to "https://example.invalid/steal", "screen" to "Unknown")))
        assertNull(resolvePushTapTarget(mapOf("liveId" to "live-1")))
        assertNull(parsePushTapTarget("conversation", "not-a-uuid", null))
        assertNull(parsePushTapTarget("post", "//outside", null))
        assertNull(parsePushTapTarget("unknown", null, null))
    }

    @Test
    fun supportsExistingGenericDestinations() {
        assertEquals(PushTapTarget(PushTapRoute.FOLLOW_REQUESTS), resolvePushTapTarget(mapOf("kind" to "followRequest")))
        assertEquals(PushTapTarget(PushTapRoute.ORDERS, "order-1"), resolvePushTapTarget(mapOf("orderId" to "order-1")))
        assertEquals(PushTapTarget(PushTapRoute.SUPPORT_TICKET, TICKET_ID), resolvePushTapTarget(mapOf("ticketId" to TICKET_ID)))
        assertEquals(PushTapTarget(PushTapRoute.CLIP, "clip-1"), resolvePushTapTarget(mapOf("clipId" to "clip-1")))
        assertEquals(PushTapTarget(PushTapRoute.DISPUTE, DISPUTE_ID), resolvePushTapTarget(mapOf("disputeId" to DISPUTE_ID)))
        assertEquals(PushTapTarget(PushTapRoute.LIVE, "live_1"), resolvePushTapTarget(mapOf("screen" to "Live", "liveId" to "live_1")))
        assertNull(resolvePushTapTarget(mapOf("screen" to "Live", "liveId" to "../admin")))
        assertNull(resolvePushTapTarget(mapOf("disputeId" to "../admin")))
    }

    @Test
    fun routesSupportedInternalUrlsWithoutOpeningExternalLinks() {
        assertEquals(
            PushTapTarget(PushTapRoute.ORDERS, "ord_1"),
            resolvePushTapTarget(mapOf("url" to "/orders/ord_1")),
        )
        assertEquals(
            PushTapTarget(PushTapRoute.POST, "post_1", "comment_1"),
            resolvePushTapTarget(mapOf("url" to "https://web.nantty.com/post/post_1/comments/comment_1")),
        )
        assertEquals(
            PushTapTarget(PushTapRoute.SUPPORT_TICKET, TICKET_ID),
            resolvePushTapTarget(mapOf("url" to "/help/tickets/$TICKET_ID")),
        )
        assertEquals(
            PushTapTarget(PushTapRoute.DISPUTE, DISPUTE_ID),
            resolvePushTapTarget(mapOf("url" to "https://web.nantty.com/disputes/$DISPUTE_ID")),
        )
        assertEquals(
            PushTapTarget(PushTapRoute.GROUP_INVITATIONS),
            resolvePushTapTarget(mapOf("url" to "/chats/invitations")),
        )
        assertEquals(
            PushTapTarget(PushTapRoute.GROUP_INVITATIONS, INVITATION_TOKEN),
            resolvePushTapTarget(mapOf("url" to "https://web.nantty.com/chats/invitations/$INVITATION_TOKEN")),
        )
        assertEquals(
            PushTapTarget(PushTapRoute.CHANNEL_INVITATIONS, INVITATION_TOKEN),
            resolvePushTapTarget(mapOf("url" to "/channels/invitations/$INVITATION_TOKEN")),
        )
        assertEquals(PushTapTarget(PushTapRoute.SPACES), resolvePushTapTarget(mapOf("url" to "/spaces")))
        assertEquals(PushTapTarget(PushTapRoute.LIVE, "live_1"), resolvePushTapTarget(mapOf("url" to "https://web.nantty.com/live/live_1")))
        assertNull(resolvePushTapTarget(mapOf("url" to "https://example.invalid/orders/ord_1")))
        assertNull(resolvePushTapTarget(mapOf("url" to "//example.invalid/orders/ord_1")))
    }

    @Test
    fun rejectsMalformedOrderTargetIdentifiers() {
        assertNull(parsePushTapTarget("orders", "../other", null))
        assertNull(parsePushTapTarget("orders", null, "unexpected"))
        assertEquals(PushTapTarget(PushTapRoute.ORDERS), parsePushTapTarget("orders", null, null))
    }

    private companion object {
        const val CONVERSATION_ID = "9e171848-0a0f-4d77-89e1-25b0a2effa90"
        const val MESSAGE_ID = "f7d1d09c-522d-4eac-b3f8-03b8c8f1012e"
        const val TICKET_ID = "1d1dc230-1e14-419c-bf8d-0d37fd9e7866"
        const val DISPUTE_ID = "7b9e2f3a-1111-4222-8333-123456789abc"
        const val INVITATION_TOKEN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
}
