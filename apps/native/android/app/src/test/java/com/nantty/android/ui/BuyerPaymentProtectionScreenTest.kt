package com.nantty.android.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class BuyerPaymentProtectionScreenTest {
    @Test
    fun mapsOnlyServerProvidedEscrowStagesAndDoesNotInventUnknownState() {
        assertEquals("Paid into escrow", buyerEscrowStageLabel("paid_into_escrow"))
        assertEquals("On the way", buyerEscrowStageLabel("shipped"))
        assertEquals("Released to seller", buyerEscrowStageLabel("released_to_seller"))
        assertEquals("Refunded", buyerEscrowStageLabel("refunded"))
        assertEquals("Status unavailable", buyerEscrowStageLabel("not-a-server-stage"))
    }
}
