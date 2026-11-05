package com.nantty.android.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class BuyerOrderDetailDisclosureTest {
    @Test
    fun directPaymentDoesNotPromiseEscrowRelease() {
        assertEquals(
            "Only confirm if everything arrived as described.",
            buyerReceiptConfirmationMessage("direct", "Ayo Market"),
        )
    }

    @Test
    fun escrowPaymentExplainsReleaseBeforeConfirmation() {
        assertEquals(
            "Only confirm if everything arrived as described. Ayo Market will be paid right away and this can't be undone.",
            buyerReceiptConfirmationMessage("escrow", "Ayo Market"),
        )
    }
}
