package com.nantty.android.ui

import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import com.nantty.android.data.CheckoutReceipt
import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.HostedPayment
import com.nantty.android.data.HostedPaymentResult
import com.nantty.android.data.PaymentConnectivityMonitor
import com.nantty.android.data.PaymentPollOutcome
import com.nantty.android.data.formatWalletAmount
import com.nantty.android.data.isServerConfirmedPaymentSuccess
import com.nantty.android.data.pollPaymentUntilSettled
import java.util.UUID
import java.util.concurrent.Executor
import java.util.concurrent.atomic.AtomicBoolean

@Composable
internal fun CheckoutPaymentScreen(
    repository: CheckoutRepository,
    executor: Executor,
    receipt: CheckoutReceipt,
    initiallyVerified: Boolean,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    onPaymentVerified: () -> Unit,
    onViewPaymentProtection: () -> Unit,
    onViewOrder: () -> Unit,
    onContinueShopping: () -> Unit,
) {
    var payment by remember(receipt.payableOrderId) { mutableStateOf<HostedPayment?>(null) }
    var busy by remember(receipt.payableOrderId) { mutableStateOf(false) }
    var status by remember(receipt.payableOrderId) { mutableStateOf("Payment is not confirmed yet.") }
    var verified by rememberSaveable(receipt.payableOrderId) { mutableStateOf(initiallyVerified) }
    var paymentKey by rememberSaveable(receipt.payableOrderId) { mutableStateOf(UUID.randomUUID().toString()) }
    var awaitingProviderReturn by rememberSaveable(receipt.payableOrderId) { mutableStateOf(false) }
    var providerPagePausedApp by rememberSaveable(receipt.payableOrderId) { mutableStateOf(false) }
    val screenDisposed = remember(receipt.payableOrderId) { AtomicBoolean(false) }
    val context = LocalContext.current
    val connectivityMonitor = remember(context) { PaymentConnectivityMonitor(context) }
    val lifecycleOwner = remember(context) { context.findLifecycleOwner() }
    val providerReturnTracker = remember(receipt.payableOrderId) {
        HostedPaymentReturnTracker(awaitingProviderReturn, providerPagePausedApp)
    }
    BackHandler(onBack = onBack)

    fun verifyPaymentStatus() {
        if (busy) return
        busy = true
        status = "Checking payment status with Nantty…"
        executor.execute {
            val outcome = pollPaymentUntilSettled(
                check = { repository.verifyPayment(receipt.payableOrderId) },
                isOnline = connectivityMonitor::isOnline,
                isCancelled = { screenDisposed.get() || Thread.currentThread().isInterrupted },
                onOfflineChange = { offline ->
                    if (!screenDisposed.get()) androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                        status = if (offline) "You're offline. We'll resume checking when your connection returns." else "Checking payment status with Nantty…"
                    }
                },
            )
            if (!screenDisposed.get()) {
                androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    busy = false
                    when (outcome) {
                        PaymentPollOutcome.PAID -> {
                            status = "Payment verified by Nantty."
                            verified = isServerConfirmedPaymentSuccess(outcome)
                        }
                        PaymentPollOutcome.FAILED -> status = "Payment was not completed. Your order remains unpaid; retry securely or check your orders."
                        PaymentPollOutcome.TIMEOUT -> status = "Payment is still processing. You can check again shortly; your order remains unpaid until Nantty confirms payment."
                        PaymentPollOutcome.CANCELLED -> Unit
                        PaymentPollOutcome.AUTHENTICATION_REQUIRED -> status = "Your session has expired. Sign in again to continue."
                    }
                    if (isServerConfirmedPaymentSuccess(outcome)) onPaymentVerified()
                }
                if (outcome == PaymentPollOutcome.AUTHENTICATION_REQUIRED) onAuthenticationRequired()
            }
        }
    }
    val verifyPaymentState = rememberUpdatedState<() -> Unit> { verifyPaymentStatus() }
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> if (providerReturnTracker.onPause()) {
                    providerPagePausedApp = true
                }
                Lifecycle.Event.ON_RESUME -> if (providerReturnTracker.onResume()) {
                    awaitingProviderReturn = false
                    providerPagePausedApp = false
                    verifyPaymentState.value()
                }
                else -> Unit
            }
        }
        lifecycleOwner?.lifecycle?.addObserver(observer)
        onDispose { lifecycleOwner?.lifecycle?.removeObserver(observer) }
    }
    DisposableEffect(screenDisposed, connectivityMonitor) {
        connectivityMonitor.start()
        onDispose {
            screenDisposed.set(true)
            connectivityMonitor.close()
        }
    }

    Column(
        Modifier.fillMaxSize().widthIn(max = 640.dp).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            if (verified) "Payment confirmed" else "Order created",
            Modifier.semantics { heading() },
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.size(12.dp))
        Text("${receipt.orderCount} ${if (receipt.orderCount == 1) "seller order" else "seller orders"} · ${formatWalletAmount(receipt.total)}", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.size(8.dp))
        Text(
            if (verified) "Your payment has been confirmed. View your order for delivery updates and any payment-protection information available for this order." else status,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite },
        )
        Spacer(Modifier.size(20.dp))
        if (verified) {
            Button(onClick = onViewPaymentProtection, modifier = Modifier.fillMaxWidth()) { Text("See payment protection") }
            OutlinedButton(onClick = onViewOrder, modifier = Modifier.fillMaxWidth()) { Text("View order") }
            OutlinedButton(onClick = onContinueShopping, modifier = Modifier.fillMaxWidth()) { Text("Continue shopping") }
        } else if (payment == null) {
            Button(
                enabled = !busy,
                onClick = {
                    busy = true
                    executor.execute {
                        when (val result = repository.initializePayment(receipt.payableOrderId, paymentKey)) {
                            is HostedPaymentResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                payment = result.payment
                                busy = false
                                status = "Open the secure payment page, complete payment, then return here to verify."
                            }
                            is HostedPaymentResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                busy = false
                                status = result.message
                                if (result.authenticationRequired) onAuthenticationRequired()
                            }
                        }
                    }
                },
            ) { if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("Set up secure payment") }
        } else {
            Text(
                "You will leave Nantty and continue at ${Uri.parse(payment!!.checkoutUrl).host}.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.size(8.dp))
            Button(
                enabled = !busy,
                onClick = {
                    providerReturnTracker.prepareForReturn()
                    awaitingProviderReturn = true
                    runCatching {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(payment!!.checkoutUrl))
                        context.startActivity(intent)
                    }.onFailure {
                        providerReturnTracker.cancel()
                        awaitingProviderReturn = false
                        providerPagePausedApp = false
                        status = "No browser could open the secure payment page. Try another browser or check payment status."
                    }
                },
            ) {
                Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Open secure payment")
            }
            OutlinedButton(
                enabled = !busy,
                onClick = ::verifyPaymentStatus,
            ) { if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("Check payment status") }
        }
        Spacer(Modifier.size(12.dp))
        OutlinedButton(onClick = onBack, enabled = !busy) { Text("Return to cart") }
        Text(
            "Returning from a payment page does not prove payment. Nantty’s verification response is authoritative.",
            Modifier.padding(top = 20.dp),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

internal class HostedPaymentReturnTracker(
    awaitingReturn: Boolean = false,
    appWasPaused: Boolean = false,
) {
    private var awaitingProviderReturn = awaitingReturn
    private var providerPausedApp = appWasPaused

    fun prepareForReturn() {
        awaitingProviderReturn = true
        providerPausedApp = false
    }

    fun onPause(): Boolean {
        if (awaitingProviderReturn) providerPausedApp = true
        return providerPausedApp
    }

    fun onResume(): Boolean {
        if (!awaitingProviderReturn || !providerPausedApp) return false
        cancel()
        return true
    }

    fun cancel() {
        awaitingProviderReturn = false
        providerPausedApp = false
    }
}

private fun Context.findLifecycleOwner(): LifecycleOwner? {
    var current: Context? = this
    while (current != null) {
        if (current is LifecycleOwner) return current
        current = (current as? ContextWrapper)?.baseContext
    }
    return null
}
