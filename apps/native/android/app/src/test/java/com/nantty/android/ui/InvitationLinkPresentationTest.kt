package com.nantty.android.ui

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Test

class InvitationLinkPresentationTest {
    @Test
    fun exposesOnlyBackendSupportedExpiryOptions() {
        assertEquals(listOf(24, 168, 720), invitationLinkExpiryOptions.map(InvitationLinkExpiryOption::hours))
    }

    @Test
    fun linkStatusAccountsForExpiryRevocationAndMalformedDates() {
        val now = Instant.parse("2026-11-06T12:00:00Z")
        assertEquals(InvitationLinkStatus.ACTIVE, invitationLinkStatus("2026-11-07T12:00:00Z", null, now))
        assertEquals(InvitationLinkStatus.EXPIRED, invitationLinkStatus("2026-11-06T12:00:00Z", null, now))
        assertEquals(InvitationLinkStatus.REVOKED, invitationLinkStatus("2026-11-07T12:00:00Z", "2026-11-06T11:00:00Z", now))
        assertEquals(InvitationLinkStatus.UNKNOWN, invitationLinkStatus("not-a-date", null, now))
    }
}
