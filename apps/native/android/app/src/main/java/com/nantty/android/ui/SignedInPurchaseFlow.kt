package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.setValue
import com.nantty.android.data.CheckoutReceipt
import com.nantty.android.data.CheckoutPaymentMethod
import com.nantty.android.data.BuyerOrderDetail
import com.nantty.android.data.ProductPurchaseSignal
import com.nantty.android.data.MartRepository
import com.nantty.android.data.decodeProductPurchaseSignals
import com.nantty.android.data.encodeProductPurchaseSignals
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
    paymentMethod: CheckoutPaymentMethod = CheckoutPaymentMethod.HOSTED,
    saveCardOnDevice: Boolean = false,
    paymentConfirmed: Boolean = false,
    cartAddressId: String? = null,
    returnToOrdersAfterPayment: Boolean = false,
    productSignals: List<ProductPurchaseSignal> = emptyList(),
    purchaseSignalsRecorded: Boolean = false,
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
    var paymentMethod by mutableStateOf(paymentMethod)
        private set
    var saveCardOnDevice by mutableStateOf(saveCardOnDevice)
        private set
    var paymentConfirmed by mutableStateOf(paymentConfirmed)
        private set
    var cartAddressId by mutableStateOf(cartAddressId)
        private set
    var returnToOrdersAfterPayment by mutableStateOf(returnToOrdersAfterPayment)
        private set
    var productSignals by mutableStateOf(productSignals)
        private set
    var purchaseSignalsRecorded by mutableStateOf(purchaseSignalsRecorded)
        private set

    fun openCart() { destination = SignedInPurchaseDestination.Cart }
    fun selectCartAddress(addressId: String?) { cartAddressId = addressId }
    fun proceedToCheckout(addressId: String? = cartAddressId) {
        cartAddressId = addressId
        destination = SignedInPurchaseDestination.Checkout
    }
    fun backFromCheckout() { destination = SignedInPurchaseDestination.Cart }
    fun backFromPayment(): Boolean {
        val returnToOrders = returnToOrdersAfterPayment
        destination = if (returnToOrders) null else SignedInPurchaseDestination.Cart
        returnToOrdersAfterPayment = false
        if (returnToOrders) paymentConfirmed = false
        return returnToOrders
    }
    fun backToPayment() { destination = SignedInPurchaseDestination.Payment }
    fun backFromCart() { destination = null }
    fun showPaymentProtection() { destination = SignedInPurchaseDestination.PaymentProtection }
    fun showPaidOrder() { destination = SignedInPurchaseDestination.PaidOrderDetail }
    fun markPaymentVerified(martRepository: MartRepository? = null) {
        paymentConfirmed = true
        if (martRepository != null && !purchaseSignalsRecorded) {
            productSignals.forEach { signal -> martRepository.recordProductPurchased(signal.productId, signal.quantity) }
            purchaseSignalsRecorded = true
        }
    }
    fun continueShopping() { destination = null }

    fun checkoutCreated(receipt: CheckoutReceipt) {
        orderId = receipt.payableOrderId
        checkoutId = receipt.checkoutId
        totalMinor = receipt.total.amountMinor
        currency = receipt.total.currency
        orderCount = receipt.orderCount
        paymentMethod = receipt.paymentMethod
        saveCardOnDevice = receipt.saveCardOnDevice
        productSignals = receipt.productSignals
        purchaseSignalsRecorded = false
        paymentConfirmed = false
        returnToOrdersAfterPayment = false
        destination = SignedInPurchaseDestination.Payment
    }

    fun checkExistingOrderPayment(order: BuyerOrderDetail): Boolean {
        if (order.status != "pending") return false
        orderId = order.id
        checkoutId = order.id
        totalMinor = order.totalMinor.coerceAtLeast(0L)
        currency = order.currency
        orderCount = 1
        productSignals = emptyList()
        purchaseSignalsRecorded = true
        paymentMethod = CheckoutPaymentMethod.HOSTED
        paymentConfirmed = false
        returnToOrdersAfterPayment = true
        destination = SignedInPurchaseDestination.Payment
        return true
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
                    state.paymentMethod.name,
                    state.paymentConfirmed,
                    state.cartAddressId.orEmpty(),
                    state.returnToOrdersAfterPayment,
                    state.saveCardOnDevice,
                    encodeProductPurchaseSignals(state.productSignals),
                    state.purchaseSignalsRecorded,
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
                    paymentMethod = (saved.getOrNull(6) as? String)?.let { value -> CheckoutPaymentMethod.entries.firstOrNull { it.name == value } } ?: CheckoutPaymentMethod.HOSTED,
                    paymentConfirmed = saved.getOrNull(7) as? Boolean ?: false,
                    cartAddressId = (saved.getOrNull(8) as? String)?.takeIf(String::isNotBlank),
                    returnToOrdersAfterPayment = saved.getOrNull(9) as? Boolean ?: false,
                    saveCardOnDevice = saved.getOrNull(10) as? Boolean ?: false,
                    productSignals = (saved.getOrNull(11) as? String)?.let(::decodeProductPurchaseSignals).orEmpty(),
                    purchaseSignalsRecorded = saved.getOrNull(12) as? Boolean ?: false,
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
    paymentMethod: CheckoutPaymentMethod,
    saveCardOnDevice: Boolean,
    paymentConfirmed: Boolean,
    returnToOrdersAfterPayment: Boolean,
    cartAddressId: String?,
    productSignals: List<ProductPurchaseSignal>,
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
    onSelectCartAddress: (String?) -> Unit,
    onProceedToCheckout: (String?) -> Unit,
    onOpenStore: (String) -> Unit,
    onOpenProduct: (String) -> Unit,
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
                    returnRepository = repositories.buyerReturns,
                    executor = executor,
                    onBack = onBackToPayment,
                    onAuthenticationRequired = onAuthenticationRequired,
                    disputeRepository = repositories.disputes,
                    privateMediaUploadsRepository = repositories.privateMediaUploads,
                    onOpenStore = onOpenStore,
                    onOpenProduct = { productId ->
                        onContinueShopping()
                        onOpenProduct(productId)
                    },
                    reviewRepository = repositories.productReviews,
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
                productSignals = productSignals,
                paymentMethod = paymentMethod,
                saveCardOnDevice = saveCardOnDevice,
                repository = repositories.checkout,
                providerWalletRepository = repositories.providerWalletPayments,
                savedCardRepository = repositories.savedCards,
                savedCardCredentialStore = repositories.savedCardCredentials,
                executor = executor,
                onBack = onBackFromPayment,
                onAuthenticationRequired = onAuthenticationRequired,
                initiallyVerified = paymentConfirmed,
                autoVerifyOnEnter = returnToOrdersAfterPayment,
                onPaymentVerified = onPaymentVerified,
                onViewPaymentProtection = onViewPaymentProtection,
                onViewOrder = onViewOrder,
                onContinueShopping = onContinueShopping,
            )
        }

        SignedInPurchaseDestination.Checkout -> HingeSafeContent {
            CheckoutScreen(
                repository = repositories.checkout,
                providerWalletRepository = repositories.providerWalletPayments,
                savedCardCredentialStore = repositories.savedCardCredentials,
                executor = executor,
                initialAddressId = cartAddressId,
                onBack = onBackFromCheckout,
                onAuthenticationRequired = onAuthenticationRequired,
                onCheckoutCreated = onCheckoutCreated,
            )
        }

        SignedInPurchaseDestination.Cart -> HingeSafeContent {
            CartScreen(
                repository = repositories.cart,
                checkoutRepository = repositories.checkout,
                executor = executor,
                selectedAddressId = cartAddressId,
                onAddressSelected = onSelectCartAddress,
                onBack = onBackFromCart,
                onAuthenticationRequired = onAuthenticationRequired,
                onProceedToCheckout = onProceedToCheckout,
            )
        }
    }
}
