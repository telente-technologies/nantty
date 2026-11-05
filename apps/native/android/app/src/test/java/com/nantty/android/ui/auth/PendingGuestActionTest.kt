package com.nantty.android.ui.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PendingGuestActionTest {
    @Test
    fun actionIsConsumedExactlyOnceAfterSuccessfulSignIn() {
        val pending = PendingGuestAction()
        var calls = 0
        pending.remember { calls += 1 }

        pending.takeAfterSignIn()?.invoke()
        pending.takeAfterSignIn()?.invoke()

        assertEquals(1, calls)
    }

    @Test
    fun cancellationDiscardsPendingAction() {
        val pending = PendingGuestAction()
        var calls = 0
        pending.remember { calls += 1 }
        pending.discard()

        pending.takeAfterSignIn()?.invoke()

        assertEquals(0, calls)
        assertNull(pending.takeAfterSignIn())
    }
}
