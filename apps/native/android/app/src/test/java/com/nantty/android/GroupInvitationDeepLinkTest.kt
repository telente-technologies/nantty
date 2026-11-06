package com.nantty.android

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class GroupInvitationDeepLinkTest {
    private val token = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG"

    @Test
    fun acceptsOnlyTrustedHttpsAndNanttyRoutes() {
        assertEquals(token, GroupInvitationDeepLink.tokenFrom("https://web.nantty.com/chats/invitations/$token"))
        assertEquals(token, GroupInvitationDeepLink.tokenFrom("nantty://chats/invitations/$token"))
        assertEquals(token, GroupInvitationDeepLink.tokenFrom("https://staging.nantty.com/chats/invitations/$token", "staging.nantty.com"))
    }

    @Test
    fun rejectsUntrustedOrMalformedUrlsAndTokens() {
        listOf(
            "http://web.nantty.com/chats/invitations/$token",
            "https://evil.example/chats/invitations/$token",
            "https://web.nantty.com.evil.example/chats/invitations/$token",
            "https://user@web.nantty.com/chats/invitations/$token",
            "https://web.nantty.com:443/chats/invitations/$token",
            "https://web.nantty.com/chats/invitations/$token?next=evil",
            "https://web.nantty.com/chats/invitations/$token#fragment",
            "https://web.nantty.com/chats/invitations/$token/extra",
            "https://web.nantty.com/chats/invitations/${token.dropLast(1)}",
            "nantty://other/$token",
            "nantty://chats/invitations/$token?x=1",
        ).forEach { assertNull("Should reject $it", GroupInvitationDeepLink.tokenFrom(it)) }
    }

    @Test
    fun createsShareUrlOnlyForHttpsRootAndValidToken() {
        assertEquals("https://web.nantty.com/chats/invitations/$token", GroupInvitationDeepLink.shareUrl("https://web.nantty.com", token))
        assertEquals("https://web.nantty.com/chats/invitations/$token", GroupInvitationDeepLink.shareUrl("https://web.nantty.com/", token))
        assertNull(GroupInvitationDeepLink.shareUrl("http://web.nantty.com", token))
        assertNull(GroupInvitationDeepLink.shareUrl("https://web.nantty.com/path", token))
        assertNull(GroupInvitationDeepLink.shareUrl("https://evil.example", token))
        assertNull(GroupInvitationDeepLink.shareUrl("https://web.nantty.com", "short"))
    }
}
