package com.nantty.android.ui

import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.HostedPayment
import com.nantty.android.data.HostedPaymentResult
import com.nantty.android.data.SavedCardRepository
import com.nantty.android.data.SavedCardResult
import com.nantty.android.data.SavedCardCharge

internal sealed interface SavedCardPaymentAttempt {
    data class Prepared(val payment: HostedPayment) : SavedCardPaymentAttempt
    data class Failure(val message: String, val authenticationRequired: Boolean = false) : SavedCardPaymentAttempt
}

/** Initializes the server-owned order intent, then charges its reference with a separate idempotency key. */
internal fun prepareSavedCardPayment(
    checkoutRepository: CheckoutRepository,
    orderId: String,
    paymentIdempotencyKey: String,
): SavedCardPaymentAttempt {
    val initialized = when (
        val result = checkoutRepository.initializePayment(orderId, paymentIdempotencyKey, requireHostedUrl = true)
    ) {
        is HostedPaymentResult.Success -> result.payment
        is HostedPaymentResult.Failure -> return SavedCardPaymentAttempt.Failure(result.message, result.authenticationRequired)
    }
    if (initialized.reference.isNullOrBlank()) {
        return SavedCardPaymentAttempt.Failure("Nantty couldn't prepare this saved-card payment. Use secure payment instead.")
    }
    return SavedCardPaymentAttempt.Prepared(initialized)
}

internal fun chargePreparedSavedCardPayment(
    savedCardRepository: SavedCardRepository,
    paymentReference: String,
    savedCardId: String,
    idempotencyKey: String,
): SavedCardResult<SavedCardCharge> = savedCardRepository.charge(paymentReference, savedCardId, idempotencyKey)
