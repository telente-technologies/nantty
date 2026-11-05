package com.nantty.android.ui

import androidx.compose.runtime.Composable
import com.nantty.android.data.CheckoutReceipt
import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.WalletMoney
import java.util.concurrent.Executor

/** Renders the signed-in checkout payment route while its navigation state stays in SignedInApp. */
@Composable
internal fun SignedInPaymentDestination(
    orderId: String?,
    checkoutId: String?,
    totalMinor: Long,
    currency: String,
    orderCount: Int,
    repository: CheckoutRepository,
    executor: Executor,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    onViewOrders: () -> Unit,
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
            ),
            onBack = onBack,
            onAuthenticationRequired = onAuthenticationRequired,
            onViewOrders = onViewOrders,
        )
    }
}
