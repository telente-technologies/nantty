package com.nantty.android.ui

import com.nantty.android.data.CheckoutReceipt
import com.nantty.android.data.BuyerOrderDetail
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
    fun selectedCartAddressIsPassedIntoCheckoutAndSurvivesBackNavigation() {
        val state = SignedInPurchaseState()
        val addressId = "8b3a4e12-1234-4234-9234-123456789abc"

        state.openCart()
        state.selectCartAddress(addressId)
        state.proceedToCheckout()
        assertEquals(SignedInPurchaseDestination.Checkout, state.destination)
        assertEquals(addressId, state.cartAddressId)

        state.backFromCheckout()
        assertEquals(SignedInPurchaseDestination.Cart, state.destination)
        assertEquals(addressId, state.cartAddressId)
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

    @Test
    fun existingPendingOrderPaymentUsesTheServerVerifiedPaymentRouteAndReturnsToOrders() {
        val state = SignedInPurchaseState()

        assertTrue(state.checkExistingOrderPayment(pendingOrder()))

        assertEquals(SignedInPurchaseDestination.Payment, state.destination)
        assertEquals("order-123", state.orderId)
        assertEquals("order-123", state.checkoutId)
        assertEquals(12_500L, state.totalMinor)
        assertEquals("NGN", state.currency)
        assertEquals(1, state.orderCount)
        assertTrue(state.returnToOrdersAfterPayment)

        state.markPaymentVerified()
        assertTrue(state.paymentConfirmed)
        state.backFromPayment()
        assertEquals(null, state.destination)
        assertFalse(state.returnToOrdersAfterPayment)
        assertFalse(state.paymentConfirmed)
    }

    @Test
    fun nonPendingOrderCannotEnterPaymentRoute() {
        val state = SignedInPurchaseState()

        assertFalse(state.checkExistingOrderPayment(pendingOrder().copy(status = "shipped")))
        assertEquals(null, state.destination)
        assertFalse(state.returnToOrdersAfterPayment)
    }

    private fun pendingOrder() = BuyerOrderDetail(
        id = "order-123",
        reference = "NT-123",
        status = "pending",
        fulfilmentStatus = "pending",
        paymentStatus = "pending",
        paymentMode = "escrow",
        storeId = "store-1",
        storeName = "Ayo Market",
        items = emptyList(),
        subtotalMinor = 12_500,
        discountMinor = 0,
        storeCreditMinor = 0,
        shippingMinor = 0,
        totalMinor = 12_500,
        currency = "NGN",
        createdAt = "2026-11-05T10:00:00Z",
        escrowReleaseAt = null,
        shipment = null,
        delivery = null,
        promotionIssue = null,
    )
}
