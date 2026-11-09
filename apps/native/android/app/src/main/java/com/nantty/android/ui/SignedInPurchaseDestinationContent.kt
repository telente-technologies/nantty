package com.nantty.android.ui

import androidx.compose.runtime.Composable
import java.util.concurrent.Executor

@Composable
internal fun SignedInPurchaseDestinationContent(
    state: SignedInPurchaseState,
    repositories: SignedInRepositories,
    executor: Executor,
    onAuthenticationRequired: () -> Unit,
    onReturnToOrders: () -> Unit,
    onContinueShopping: () -> Unit,
    onOpenStore: (String) -> Unit,
    onOpenProduct: (String) -> Unit,
) {
    val destination = state.destination ?: return
    SignedInPurchaseFlow(
        destination = destination,
        orderId = state.orderId,
        checkoutId = state.checkoutId,
        totalMinor = state.totalMinor,
        currency = state.currency,
        orderCount = state.orderCount,
        paymentMethod = state.paymentMethod,
        saveCardOnDevice = state.saveCardOnDevice,
        paymentConfirmed = state.paymentConfirmed,
        returnToOrdersAfterPayment = state.returnToOrdersAfterPayment,
        cartAddressId = state.cartAddressId,
        productSignals = state.productSignals,
        repositories = repositories,
        executor = executor,
        onBackToPayment = state::backToPayment,
        onBackFromPayment = { if (state.backFromPayment()) onReturnToOrders() },
        onBackFromCheckout = state::backFromCheckout,
        onBackFromCart = state::backFromCart,
        onAuthenticationRequired = onAuthenticationRequired,
        onPaymentVerified = { state.markPaymentVerified(repositories.mart) },
        onViewPaymentProtection = state::showPaymentProtection,
        onViewOrder = state::showPaidOrder,
        onContinueShopping = {
            state.continueShopping()
            onContinueShopping()
        },
        onCheckoutCreated = state::checkoutCreated,
        onSelectCartAddress = state::selectCartAddress,
        onProceedToCheckout = state::proceedToCheckout,
        onOpenStore = { storeId ->
            state.continueShopping()
            onOpenStore(storeId)
        },
        onOpenProduct = { productId ->
            state.continueShopping()
            onOpenProduct(productId)
        },
    )
}
