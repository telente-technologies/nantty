package com.nantty.android.data

internal enum class PaymentPollOutcome { PAID, FAILED, TIMEOUT, CANCELLED, AUTHENTICATION_REQUIRED }

internal fun isServerConfirmedPaymentSuccess(outcome: PaymentPollOutcome): Boolean = outcome == PaymentPollOutcome.PAID

/** Rechecks only the server's verification response; a provider redirect is never treated as proof. */
internal fun pollPaymentUntilSettled(
    check: () -> PaymentVerificationResult,
    isOnline: () -> Boolean,
    isCancelled: () -> Boolean,
    onOfflineChange: (Boolean) -> Unit = {},
    intervalMillis: Long = PAYMENT_POLL_INTERVAL_MILLIS,
    timeoutMillis: Long = PAYMENT_POLL_TIMEOUT_MILLIS,
    nowMillis: () -> Long = { System.nanoTime() / NANOS_PER_MILLI },
    sleep: (Long) -> Unit = Thread::sleep,
): PaymentPollOutcome {
    require(intervalMillis > 0) { "Payment poll interval must be positive." }
    require(timeoutMillis >= 0) { "Payment poll timeout cannot be negative." }
    var deadline = nowMillis() + timeoutMillis
    var offline = false

    while (nowMillis() < deadline) {
        if (isCancelled()) return PaymentPollOutcome.CANCELLED
        if (!isOnline()) {
            if (!offline) onOfflineChange(true)
            offline = true
            deadline += intervalMillis
            if (!wait(intervalMillis, sleep)) return PaymentPollOutcome.CANCELLED
            continue
        }
        if (offline) onOfflineChange(false)
        offline = false

        when (val result = runCatching(check).getOrNull()) {
            PaymentVerificationResult.Paid -> return PaymentPollOutcome.PAID
            PaymentVerificationResult.Failed -> return PaymentPollOutcome.FAILED
            is PaymentVerificationResult.Failure -> if (result.authenticationRequired) {
                return PaymentPollOutcome.AUTHENTICATION_REQUIRED
            }
            PaymentVerificationResult.Pending, null -> Unit
        }
        if (!wait(intervalMillis, sleep)) return PaymentPollOutcome.CANCELLED
    }
    return if (isCancelled()) PaymentPollOutcome.CANCELLED else PaymentPollOutcome.TIMEOUT
}

private fun wait(intervalMillis: Long, sleep: (Long) -> Unit): Boolean = try {
    sleep(intervalMillis)
    true
} catch (_: InterruptedException) {
    Thread.currentThread().interrupt()
    false
}

internal const val PAYMENT_POLL_INTERVAL_MILLIS = 3_000L
internal const val PAYMENT_POLL_TIMEOUT_MILLIS = 120_000L
private const val NANOS_PER_MILLI = 1_000_000L
