package com.nantty.android.ui

import com.nantty.android.data.CheckoutReceipt
import com.nantty.android.data.WalletMoney
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SignedInPurchaseStateTest {
    @Test
    fun cartCheckoutAndPaymentTransitionsKeepTheOrderReceipt() {
        val state = SignedInPurchaseState()

        state.openCart()
        assertEquals(SignedInPurchaseDestination.Cart, state.destination)
        state.proceedToCheckout()
        assertEquals(SignedInPurchaseDestination.Checkout, state.destination)

        state.checkoutCreated(
            CheckoutReceipt(
                checkoutId = "checkout-1",
                payableOrderId = "order-1",
                total = WalletMoney(12_500, "NGN"),
                orderCount = 2,
            ),
        )

        assertEquals(SignedInPurchaseDestination.Payment, state.destination)
        assertEquals("order-1", state.orderId)
        assertEquals("checkout-1", state.checkoutId)
        assertEquals(12_500L, state.totalMinor)
        assertEquals("NGN", state.currency)
        assertEquals(2, state.orderCount)
        assertFalse(state.paymentConfirmed)
    }

    @Test
    fun paymentProtectionAndOrderDetailReturnToPaymentAndOnlyServerCallbackMarksVerified() {
        val state = SignedInPurchaseState(destination = SignedInPurchaseDestination.Payment, orderId = "order-1")

        state.showPaymentProtection()
        assertEquals(SignedInPurchaseDestination.PaymentProtection, state.destination)
        state.backToPayment()
        assertEquals(SignedInPurchaseDestination.Payment, state.destination)
        assertFalse(state.paymentConfirmed)

        state.markPaymentVerified()
        assertTrue(state.paymentConfirmed)
        state.showPaidOrder()
        assertEquals(SignedInPurchaseDestination.PaidOrderDetail, state.destination)
        state.backToPayment()
        assertEquals(SignedInPurchaseDestination.Payment, state.destination)
    }

    @Test
    fun returningFromPaymentAndContinuingShoppingClearOnlyThePurchaseRoute() {
        val state = SignedInPurchaseState(destination = SignedInPurchaseDestination.Payment, orderId = "order-1")
        state.backFromPayment()
        assertEquals(SignedInPurchaseDestination.Cart, state.destination)
        state.continueShopping()
        assertEquals(null, state.destination)
        assertEquals("order-1", state.orderId)
    }
}
