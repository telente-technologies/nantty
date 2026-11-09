package com.nantty.android.ui

import androidx.compose.runtime.Composable
import com.nantty.android.data.CheckoutReceipt
import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.CheckoutPaymentMethod
import com.nantty.android.data.ProviderWalletPaymentRepository
import com.nantty.android.data.SavedCardCredentialStore
import com.nantty.android.data.SavedCardRepository
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.ProductPurchaseSignal
import java.util.concurrent.Executor

/** Renders the signed-in checkout payment route while its navigation state stays in SignedInApp. */
@Composable
internal fun SignedInPaymentDestination(
    orderId: String?,
    checkoutId: String?,
    totalMinor: Long,
    currency: String,
    orderCount: Int,
    productSignals: List<ProductPurchaseSignal>,
    paymentMethod: CheckoutPaymentMethod,
    saveCardOnDevice: Boolean,
    repository: CheckoutRepository,
    providerWalletRepository: ProviderWalletPaymentRepository,
    savedCardRepository: SavedCardRepository,
    savedCardCredentialStore: SavedCardCredentialStore,
    executor: Executor,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    initiallyVerified: Boolean,
    autoVerifyOnEnter: Boolean,
    onPaymentVerified: () -> Unit,
    onViewPaymentProtection: () -> Unit,
    onViewOrder: () -> Unit,
    onContinueShopping: () -> Unit,
) {
    if (orderId == null) return

    HingeSafeContent {
        CheckoutPaymentScreen(
            repository = repository,
            executor = executor,
            receipt = CheckoutReceipt(
                checkoutId = checkoutId ?: orderId,
                payableOrderId = orderId,
                total = WalletMoney(totalMinor, currency),
                orderCount = orderCount,
                productSignals = productSignals,
                paymentMethod = paymentMethod,
                saveCardOnDevice = saveCardOnDevice,
            ),
            providerWalletRepository = providerWalletRepository,
            savedCardRepository = savedCardRepository,
            savedCardCredentialStore = savedCardCredentialStore,
            initiallyVerified = initiallyVerified,
            autoVerifyOnEnter = autoVerifyOnEnter,
            onBack = onBack,
            onAuthenticationRequired = onAuthenticationRequired,
            onPaymentVerified = onPaymentVerified,
            onViewPaymentProtection = onViewPaymentProtection,
            onViewOrder = onViewOrder,
            onContinueShopping = onContinueShopping,
        )
    }
}
