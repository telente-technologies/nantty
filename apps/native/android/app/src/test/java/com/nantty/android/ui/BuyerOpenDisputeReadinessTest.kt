package com.nantty.android.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BuyerOpenDisputeReadinessTest {
    @Test
    fun requiresValidReasonAndTrimmedMinimumDescription() {
        assertFalse(buyerDisputeSubmitReadiness(null, "A sufficiently long description", 1, false))
        assertFalse(buyerDisputeSubmitReadiness("damaged", "      ", 1, false))
        assertFalse(buyerDisputeSubmitReadiness("damaged", "1234567890123456789", 1, false))
        assertTrue(buyerDisputeSubmitReadiness("other", "  12345678901234567890  ", 0, false))
    }

    @Test
    fun descriptionIsLimitedToOneThousandAndPhotoReasonRequiresEvidence() {
        assertTrue(buyerDisputeSubmitReadiness("damaged", "x".repeat(1_000), 1, false))
        assertFalse(buyerDisputeSubmitReadiness("damaged", "x".repeat(1_001), 1, false))
        assertFalse(buyerDisputeSubmitReadiness("wrong_item", "A sufficiently long description", 0, false))
        assertTrue(buyerDisputeSubmitReadiness("not_received", "A sufficiently long description", 0, false))
    }

    @Test
    fun uploadAndExcessEvidencePreventSubmission() {
        assertFalse(buyerDisputeSubmitReadiness("other", "A sufficiently long description", 0, true))
        assertFalse(buyerDisputeSubmitReadiness("other", "A sufficiently long description", 6, false))
        assertTrue(buyerDisputeSubmitReadiness("other", "A sufficiently long description", 5, false))
    }

    @Test
    fun reasonLabelsAndHintsMirrorMobileContract() {
        assertTrue(BUYER_DISPUTE_REASON_OPTIONS.map { it.id } == listOf("not_received", "not_as_described", "damaged", "wrong_item", "other"))
        assertTrue(BUYER_DISPUTE_REASON_OPTIONS.map { it.label } == listOf(
            "I didn't receive my order",
            "Item isn't as described",
            "Item arrived damaged",
            "I received the wrong item",
            "Something else",
        ))
        assertTrue(BUYER_DISPUTE_REASON_OPTIONS.map { it.hint } == listOf(
            "Tracking shows delivered or it's very late",
            "Different colour, size, quality or model",
            "Broken, cracked, leaking or torn",
            "Not what I ordered at all",
            "Tell us what happened",
        ))
    }
}
