package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.setValue
import com.nantty.android.data.CheckoutReceipt
import java.util.concurrent.Executor

internal enum class SignedInPurchaseDestination {
    PaymentProtection,
    PaidOrderDetail,
    Payment,
    Checkout,
    Cart,
}

@Stable
internal class SignedInPurchaseState(
    destination: SignedInPurchaseDestination? = null,
    orderId: String? = null,
    checkoutId: String? = null,
    totalMinor: Long = 0L,
    currency: String = "",
    orderCount: Int = 0,
    paymentConfirmed: Boolean = false,
) {
    var destination by mutableStateOf(destination)
        private set
    var orderId by mutableStateOf(orderId)
        private set
    var checkoutId by mutableStateOf(checkoutId)
        private set
    var totalMinor by mutableStateOf(totalMinor)
        private set
    var currency by mutableStateOf(currency)
        private set
    var orderCount by mutableStateOf(orderCount)
        private set
    var paymentConfirmed by mutableStateOf(paymentConfirmed)
        private set

    fun openCart() { destination = SignedInPurchaseDestination.Cart }
    fun proceedToCheckout() { destination = SignedInPurchaseDestination.Checkout }
    fun backFromCheckout() { destination = SignedInPurchaseDestination.Cart }
    fun backFromPayment() { destination = SignedInPurchaseDestination.Cart }
    fun backToPayment() { destination = SignedInPurchaseDestination.Payment }
    fun backFromCart() { destination = null }
    fun showPaymentProtection() { destination = SignedInPurchaseDestination.PaymentProtection }
    fun showPaidOrder() { destination = SignedInPurchaseDestination.PaidOrderDetail }
    fun markPaymentVerified() { paymentConfirmed = true }
    fun continueShopping() { destination = null }

    fun checkoutCreated(receipt: CheckoutReceipt) {
        orderId = receipt.payableOrderId
        checkoutId = receipt.checkoutId
        totalMinor = receipt.total.amountMinor
        currency = receipt.total.currency
        orderCount = receipt.orderCount
        paymentConfirmed = false
        destination = SignedInPurchaseDestination.Payment
    }

    companion object {
        val Saver: Saver<SignedInPurchaseState, Any> = listSaver(
            save = { state ->
                listOf(
                    state.destination?.name.orEmpty(),
                    state.orderId.orEmpty(),
                    state.checkoutId.orEmpty(),
                    state.totalMinor,
                    state.currency,
                    state.orderCount,
                    state.paymentConfirmed,
                )
            },
            restore = { saved ->
                SignedInPurchaseState(
                    destination = (saved.getOrNull(0) as? String)?.let { name ->
                        SignedInPurchaseDestination.entries.firstOrNull { it.name == name }
                    },
                    orderId = (saved.getOrNull(1) as? String)?.takeIf(String::isNotBlank),
                    checkoutId = (saved.getOrNull(2) as? String)?.takeIf(String::isNotBlank),
                    totalMinor = (saved.getOrNull(3) as? Long)?.coerceAtLeast(0L) ?: 0L,
                    currency = (saved.getOrNull(4) as? String).orEmpty(),
                    orderCount = (saved.getOrNull(5) as? Int)?.coerceAtLeast(0) ?: 0,
                    paymentConfirmed = saved.getOrNull(6) as? Boolean ?: false,
                )
            },
        )
    }
}

/** Owns the buyer commerce overlay screens; route state and transitions remain with SignedInApp. */
@Composable
internal fun SignedInPurchaseFlow(
    destination: SignedInPurchaseDestination,
    orderId: String?,
    checkoutId: String?,
    totalMinor: Long,
    currency: String,
    orderCount: Int,
    paymentConfirmed: Boolean,
    repositories: SignedInRepositories,
    executor: Executor,
    onBackToPayment: () -> Unit,
    onBackFromPayment: () -> Unit,
    onBackFromCheckout: () -> Unit,
    onBackFromCart: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    onPaymentVerified: () -> Unit,
    onViewPaymentProtection: () -> Unit,
    onViewOrder: () -> Unit,
    onContinueShopping: () -> Unit,
    onCheckoutCreated: (CheckoutReceipt) -> Unit,
    onProceedToCheckout: () -> Unit,
) {
    when (destination) {
        SignedInPurchaseDestination.PaymentProtection -> orderId?.let {
            HingeSafeContent {
                BuyerPaymentProtectionScreen(
                    orderId = it,
                    repository = repositories.disputes,
                    executor = executor,
                    onBack = onBackToPayment,
                    onAuthenticationRequired = onAuthenticationRequired,
                    onViewOrder = onViewOrder,
                    onContinueShopping = onContinueShopping,
                )
            }
        }

        SignedInPurchaseDestination.PaidOrderDetail -> orderId?.let {
            HingeSafeContent {
                BuyerOrderDetailScreen(
                    orderId = it,
                    repository = repositories.buyerOrders,
                    executor = executor,
                    onBack = onBackToPayment,
                    onAuthenticationRequired = onAuthenticationRequired,
                    disputeRepository = repositories.disputes,
                    privateMediaUploadsRepository = repositories.privateMediaUploads,
                )
            }
        }

        SignedInPurchaseDestination.Payment -> orderId?.let {
            SignedInPaymentDestination(
                orderId = it,
                checkoutId = checkoutId,
                totalMinor = totalMinor,
                currency = currency,
                orderCount = orderCount,
                repository = repositories.checkout,
                executor = executor,
                onBack = onBackFromPayment,
                onAuthenticationRequired = onAuthenticationRequired,
                initiallyVerified = paymentConfirmed,
                onPaymentVerified = onPaymentVerified,
                onViewPaymentProtection = onViewPaymentProtection,
                onViewOrder = onViewOrder,
                onContinueShopping = onContinueShopping,
            )
        }

        SignedInPurchaseDestination.Checkout -> HingeSafeContent {
            CheckoutScreen(
                repository = repositories.checkout,
                executor = executor,
                onBack = onBackFromCheckout,
                onAuthenticationRequired = onAuthenticationRequired,
                onCheckoutCreated = onCheckoutCreated,
            )
        }

        SignedInPurchaseDestination.Cart -> HingeSafeContent {
            CartScreen(
                repository = repositories.cart,
                executor = executor,
                onBack = onBackFromCart,
                onAuthenticationRequired = onAuthenticationRequired,
                onProceedToCheckout = onProceedToCheckout,
            )
        }
    }
}
