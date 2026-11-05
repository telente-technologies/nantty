package com.nantty.android.data

import org.junit.Assert.assertEquals
import org.junit.Test

class PaymentStatusPollerTest {
    @Test
    fun onlyServerVerifiedPaidOutcomeCanExposePaymentSuccess() {
        assertEquals(true, isServerConfirmedPaymentSuccess(PaymentPollOutcome.PAID))
        listOf(
            PaymentPollOutcome.FAILED,
            PaymentPollOutcome.TIMEOUT,
            PaymentPollOutcome.CANCELLED,
            PaymentPollOutcome.AUTHENTICATION_REQUIRED,
        ).forEach { outcome ->
            assertEquals(false, isServerConfirmedPaymentSuccess(outcome))
        }
    }

    @Test
    fun stopsOnlyWhenServerConfirmsPaidOrFailed() {
        val clock = FakeClock()
        val statuses = ArrayDeque(listOf(PaymentVerificationResult.Pending, PaymentVerificationResult.Pending, PaymentVerificationResult.Paid))

        val result = pollPaymentUntilSettled(
            check = { statuses.removeFirst() },
            isOnline = { true },
            isCancelled = { false },
            intervalMillis = 3_000,
            timeoutMillis = 120_000,
            nowMillis = clock::now,
            sleep = clock::sleep,
        )

        assertEquals(PaymentPollOutcome.PAID, result)
        assertEquals(6_000L, clock.elapsedMillis)
    }

    @Test
    fun serverFailureIsTerminalAndDoesNotBecomePaid() {
        val clock = FakeClock()

        val result = pollPaymentUntilSettled(
            check = { PaymentVerificationResult.Failed },
            isOnline = { true },
            isCancelled = { false },
            nowMillis = clock::now,
            sleep = clock::sleep,
        )

        assertEquals(PaymentPollOutcome.FAILED, result)
        assertEquals(0L, clock.elapsedMillis)
    }

    @Test
    fun extendsDeadlineWhileOfflineAndReportsConnectionTransitions() {
        val clock = FakeClock()
        var online = false
        var checks = 0
        val changes = mutableListOf<Boolean>()

        val result = pollPaymentUntilSettled(
            check = { checks++; PaymentVerificationResult.Paid },
            isOnline = {
                if (clock.elapsedMillis >= 9_000) online = true
                online
            },
            isCancelled = { false },
            onOfflineChange = changes::add,
            intervalMillis = 3_000,
            timeoutMillis = 6_000,
            nowMillis = clock::now,
            sleep = clock::sleep,
        )

        assertEquals(PaymentPollOutcome.PAID, result)
        assertEquals(listOf(true, false), changes)
        assertEquals(1, checks)
        assertEquals(9_000L, clock.elapsedMillis)
    }

    @Test
    fun returnsTimeoutForPersistentlyPendingAndRetriesTransientVerificationFailure() {
        val clock = FakeClock()
        var calls = 0

        val result = pollPaymentUntilSettled(
            check = {
                calls++
                if (calls == 1) PaymentVerificationResult.Failure("Temporary network failure")
                else PaymentVerificationResult.Pending
            },
            isOnline = { true },
            isCancelled = { false },
            intervalMillis = 2_000,
            timeoutMillis = 5_000,
            nowMillis = clock::now,
            sleep = clock::sleep,
        )

        assertEquals(PaymentPollOutcome.TIMEOUT, result)
        assertEquals(3, calls)
    }

    @Test
    fun exitsOnCancellationAndAuthenticationFailure() {
        val cancelled = pollPaymentUntilSettled(
            check = { error("Must not verify after cancellation") },
            isOnline = { true },
            isCancelled = { true },
            nowMillis = { 0 },
            sleep = {},
        )
        val authenticationRequired = pollPaymentUntilSettled(
            check = { PaymentVerificationResult.Failure("Sign in again", authenticationRequired = true) },
            isOnline = { true },
            isCancelled = { false },
            nowMillis = { 0 },
            sleep = {},
        )

        assertEquals(PaymentPollOutcome.CANCELLED, cancelled)
        assertEquals(PaymentPollOutcome.AUTHENTICATION_REQUIRED, authenticationRequired)
    }

    private class FakeClock {
        var elapsedMillis = 0L
            private set

        fun now() = elapsedMillis
        fun sleep(duration: Long) { elapsedMillis += duration }
    }
}
