package com.nantty.android.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CheckoutPaymentReturnTest {
    @Test
    fun paymentReturnIsVerifiedOnlyAfterLeavingForProviderAndResuming() {
        val tracker = HostedPaymentReturnTracker()
        assertFalse(tracker.onResume())

        tracker.prepareForReturn()
        assertFalse(tracker.onResume())
        assertTrue(tracker.onPause())
        assertTrue(tracker.onResume())
        assertFalse(tracker.onResume())
    }

    @Test
    fun failedLaunchAndUnrelatedPauseDoNotTriggerVerification() {
        val tracker = HostedPaymentReturnTracker()
        tracker.onPause()
        assertFalse(tracker.onResume())

        tracker.prepareForReturn()
        tracker.cancel()
        tracker.onPause()
        assertFalse(tracker.onResume())
    }
}
