package com.nantty.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ChannelInvitationDeepLinkTest {
    private val token = "b".repeat(43)

    @Test
    fun acceptsOnlyTrustedHttpsAndNanttyChannelRoutes() {
        assertEquals(token, ChannelInvitationDeepLink.tokenFrom("https://web.nantty.com/channels/invitations/$token"))
        assertEquals(token, ChannelInvitationDeepLink.tokenFrom("nantty://channels/invitations/$token"))
        assertNull(ChannelInvitationDeepLink.tokenFrom("https://attacker.test/channels/invitations/$token"))
        assertNull(ChannelInvitationDeepLink.tokenFrom("https://web.nantty.com/chats/invitations/$token"))
    }

    @Test
    fun rejectsQueryFragmentsPortsCredentialsAndMalformedTokens() {
        assertNull(ChannelInvitationDeepLink.tokenFrom("https://web.nantty.com/channels/invitations/$token?next=evil"))
        assertNull(ChannelInvitationDeepLink.tokenFrom("https://web.nantty.com/channels/invitations/$token#fragment"))
        assertNull(ChannelInvitationDeepLink.tokenFrom("https://web.nantty.com:443/channels/invitations/$token"))
        assertNull(ChannelInvitationDeepLink.tokenFrom("https://user@web.nantty.com/channels/invitations/$token"))
        assertNull(ChannelInvitationDeepLink.tokenFrom("https://web.nantty.com/channels/invitations/short"))
    }

    @Test
    fun shareUrlRequiresNanttyHttpsOriginAndValidOpaqueToken() {
        assertEquals("https://web.nantty.com/channels/invitations/$token", ChannelInvitationDeepLink.shareUrl("https://web.nantty.com", token))
        assertNull(ChannelInvitationDeepLink.shareUrl("http://web.nantty.com", token))
        assertNull(ChannelInvitationDeepLink.shareUrl("https://attacker.test", token))
        assertNull(ChannelInvitationDeepLink.shareUrl("https://web.nantty.com/path", token))
        assertNull(ChannelInvitationDeepLink.shareUrl("https://web.nantty.com", "bad"))
    }
}
