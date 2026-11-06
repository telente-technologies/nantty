package com.nantty.android.ui

import android.content.Context
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
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.nantty.android.data.CheckoutReceipt
import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.CheckoutPaymentMethod
import com.nantty.android.data.HostedPayment
import com.nantty.android.data.HostedPaymentResult
import com.nantty.android.data.PaymentConnectivityMonitor
import com.nantty.android.data.PaymentPollOutcome
import com.nantty.android.data.ProviderWalletPaymentRepository
import com.nantty.android.data.ProviderWalletPaymentResult
import com.nantty.android.data.SavedCardChargeStatus
import com.nantty.android.data.SavedCardCredentialStore
import com.nantty.android.data.SavedCardRepository
import com.nantty.android.data.SavedCardResult
import com.nantty.android.data.formatWalletAmount
import com.nantty.android.data.isServerConfirmedPaymentSuccess
import com.nantty.android.data.pollPaymentUntilSettled
import java.util.UUID
import java.util.concurrent.Executor
import java.util.concurrent.atomic.AtomicBoolean

@Composable
internal fun CheckoutPaymentScreen(
    repository: CheckoutRepository,
    providerWalletRepository: ProviderWalletPaymentRepository,
    savedCardRepository: SavedCardRepository,
    savedCardCredentialStore: SavedCardCredentialStore,
    executor: Executor,
    receipt: CheckoutReceipt,
    initiallyVerified: Boolean,
    autoVerifyOnEnter: Boolean = false,
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
    var walletPaymentKey by rememberSaveable(receipt.payableOrderId) { mutableStateOf(UUID.randomUUID().toString()) }
    var walletPaymentSubmitted by rememberSaveable(receipt.payableOrderId) { mutableStateOf(false) }
    var walletPaymentFailed by rememberSaveable(receipt.payableOrderId) { mutableStateOf(false) }
    var savedCardSetupCompleted by rememberSaveable(receipt.payableOrderId) { mutableStateOf(false) }
    var skipSavedCardSetup by rememberSaveable(receipt.payableOrderId) { mutableStateOf(false) }
    var savedCardChargeSubmitted by rememberSaveable(receipt.payableOrderId) { mutableStateOf(false) }
    var savedCardChargeFailed by rememberSaveable(receipt.payableOrderId) { mutableStateOf(false) }
    var savedCardActionRequired by rememberSaveable(receipt.payableOrderId) { mutableStateOf(false) }
    var savedCardPaymentKey by rememberSaveable(receipt.payableOrderId) { mutableStateOf(UUID.randomUUID().toString()) }
    var usingHostedFallback by rememberSaveable(receipt.payableOrderId) { mutableStateOf(false) }
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

    fun startSavedCardCharge() {
        confirmSavedCardUse(context) { biometricResult ->
            when (biometricResult) {
                SavedCardBiometricResult.Confirmed -> {
                    // This credential read is intentionally reachable only after BiometricPrompt succeeds.
                    val savedCardId = runCatching(savedCardCredentialStore::readSavedCardIdAfterUserConfirmation).getOrNull()
                    if (savedCardId.isNullOrBlank()) {
                        status = "The saved card is unavailable on this device. Use secure payment instead."
                        savedCardChargeFailed = true
                    } else {
                        busy = true
                        status = "Confirming saved-card payment with Nantty…"
                        executor.execute {
                            when (
                                val attempt = prepareSavedCardPayment(
                                    checkoutRepository = repository,
                                    orderId = receipt.payableOrderId,
                                    paymentIdempotencyKey = paymentKey,
                                )
                            ) {
                                is SavedCardPaymentAttempt.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                    busy = false
                                    status = attempt.message
                                    savedCardChargeFailed = true
                                    if (attempt.authenticationRequired) onAuthenticationRequired()
                                }
                                is SavedCardPaymentAttempt.Prepared -> when (
                                    val chargeResult = chargePreparedSavedCardPayment(
                                        savedCardRepository = savedCardRepository,
                                        paymentReference = requireNotNull(attempt.payment.reference),
                                        savedCardId = savedCardId,
                                        idempotencyKey = savedCardPaymentKey,
                                    )
                                ) {
                                    is SavedCardResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                        busy = false
                                        status = chargeResult.message
                                        savedCardChargeFailed = true
                                        if (chargeResult.authenticationRequired) onAuthenticationRequired()
                                    }
                                    is SavedCardResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                        when (chargeResult.value.status) {
                                            SavedCardChargeStatus.PAID,
                                            SavedCardChargeStatus.PENDING,
                                            SavedCardChargeStatus.PROCESSING -> {
                                                payment = null
                                                busy = false
                                                savedCardChargeSubmitted = true
                                                savedCardChargeFailed = false
                                                savedCardActionRequired = false
                                                status = "Nantty received your saved-card payment request. Confirming it securely…"
                                            }
                                            SavedCardChargeStatus.REQUIRES_AUTHENTICATION,
                                            SavedCardChargeStatus.REQUIRES_CHECKOUT -> {
                                                val actionUrl = chargeResult.value.actionUrl ?: attempt.payment.checkoutUrl
                                                busy = false
                                                if (actionUrl == null) {
                                                    payment = null
                                                    savedCardChargeFailed = true
                                                    status = "Your card needs an additional verification step. Use secure payment instead."
                                                } else {
                                                    payment = attempt.payment.copy(checkoutUrl = actionUrl)
                                                    savedCardActionRequired = true
                                                    savedCardChargeFailed = false
                                                    status = if (chargeResult.value.status == SavedCardChargeStatus.REQUIRES_AUTHENTICATION) {
                                                        "Your card provider needs an additional identity check. Continue securely, then return to Nantty for verification."
                                                    } else {
                                                        "This card needs a secure payment step. Continue with the provider, then return to Nantty for verification."
                                                    }
                                                }
                                            }
                                            SavedCardChargeStatus.FAILED -> {
                                                payment = null
                                                busy = false
                                                status = "The saved-card charge was declined. Your order remains unpaid; retry or use secure payment instead."
                                                savedCardChargeFailed = true
                                                savedCardPaymentKey = UUID.randomUUID().toString()
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                SavedCardBiometricResult.Cancelled -> status = "Saved-card payment cancelled. No charge was requested."
                SavedCardBiometricResult.Unavailable -> {
                    status = "Biometric confirmation isn't available. Use secure payment instead."
                    savedCardChargeFailed = true
                }
                is SavedCardBiometricResult.Failed -> status = biometricResult.message
            }
        }
    }

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
                        PaymentPollOutcome.FAILED -> {
                            status = "Payment was not completed. Your order remains unpaid; retry securely or check your orders."
                            if (receipt.paymentMethod == CheckoutPaymentMethod.SAVED_CARD) {
                                savedCardChargeSubmitted = false
                                savedCardChargeFailed = true
                            }
                        }
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
    androidx.compose.runtime.LaunchedEffect(receipt.payableOrderId, autoVerifyOnEnter) {
        if (autoVerifyOnEnter && !verified) verifyPaymentState.value()
    }
    androidx.compose.runtime.LaunchedEffect(receipt.payableOrderId, walletPaymentSubmitted, savedCardChargeSubmitted, verified) {
        if ((walletPaymentSubmitted || savedCardChargeSubmitted) && !verified) verifyPaymentState.value()
    }
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
        } else if (savedCardChargeSubmitted) {
            CheckoutSavedCardStatusAction(status, busy, ::verifyPaymentStatus)
        } else if (receipt.saveCardOnDevice && !savedCardSetupCompleted && !skipSavedCardSetup) {
            CheckoutSavedCardSetup(
                repository = savedCardRepository,
                credentialStore = savedCardCredentialStore,
                executor = executor,
                enabled = true,
                onAuthenticationRequired = onAuthenticationRequired,
                onSetupComplete = {
                    savedCardSetupCompleted = true
                    status = "Card verified. Confirm with biometrics to charge it for this order."
                },
                onUseHostedCheckout = {
                    skipSavedCardSetup = true
                    status = "Card setup skipped. Continue with secure payment; your order remains unpaid until Nantty verifies payment."
                },
            )
        } else if (payment == null) {
            Button(
                enabled = !busy,
                onClick = {
                    if ((receipt.paymentMethod == CheckoutPaymentMethod.SAVED_CARD || savedCardSetupCompleted) && !usingHostedFallback) {
                        startSavedCardCharge()
                        return@Button
                    }
                    busy = true
                    executor.execute {
                        val initializedPayment = when (val result = repository.initializePayment(
                            receipt.payableOrderId,
                            paymentKey,
                            requireHostedUrl = receipt.paymentMethod != CheckoutPaymentMethod.PROVIDER_WALLET || usingHostedFallback,
                        )) {
                            is HostedPaymentResult.Success -> result.payment
                            is HostedPaymentResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                busy = false
                                status = result.message
                                walletPaymentFailed = receipt.paymentMethod == CheckoutPaymentMethod.PROVIDER_WALLET && !usingHostedFallback
                                if (result.authenticationRequired) onAuthenticationRequired()
                                null
                            }
                        } ?: return@execute
                        androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot { payment = initializedPayment }
                        if (receipt.paymentMethod == CheckoutPaymentMethod.PROVIDER_WALLET && !usingHostedFallback) {
                            val reference = initializedPayment.reference
                            if (reference.isNullOrBlank()) {
                                androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                    payment = null
                                    busy = false
                                    walletPaymentFailed = true
                                    status = "Nantty could not prepare this wallet payment. Check payment status or return to checkout."
                                }
                            } else {
                                when (val walletResult = providerWalletRepository.payFromWallet(reference, walletPaymentKey)) {
                                    ProviderWalletPaymentResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                        busy = false
                                        walletPaymentSubmitted = true
                                        walletPaymentFailed = false
                                        status = "Nantty received your wallet payment request. Confirming it securely…"
                                    }
                                    is ProviderWalletPaymentResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                        payment = null
                                        busy = false
                                        walletPaymentFailed = true
                                        status = walletResult.message
                                        if (walletResult.authenticationRequired) onAuthenticationRequired()
                                    }
                                }
                            }
                        }
                    }
                },
            ) {
                if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                else Text(
                    when {
                        autoVerifyOnEnter -> "Finish payment"
                        receipt.paymentMethod == CheckoutPaymentMethod.PROVIDER_WALLET && !usingHostedFallback -> "Pay from wallet"
                        receipt.paymentMethod == CheckoutPaymentMethod.SAVED_CARD && !usingHostedFallback -> "Pay with saved card"
                        savedCardSetupCompleted && !usingHostedFallback -> "Pay with saved card"
                        else -> "Set up secure payment"
                    },
                )
            }
            OutlinedButton(
                enabled = !busy,
                onClick = ::verifyPaymentStatus,
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                else Text("Check payment status")
            }
            CheckoutSecurePaymentFallbackAction(
                visible = (walletPaymentFailed || savedCardChargeFailed) && !usingHostedFallback,
                enabled = !busy,
                onClick = {
                        usingHostedFallback = true
                        walletPaymentFailed = false
                        savedCardChargeFailed = false
                        savedCardActionRequired = false
                        payment = null
                        status = "Choose the secure payment page to continue. Your order remains unpaid until Nantty verifies it."
                },
            )
        } else if (walletPaymentSubmitted && receipt.paymentMethod == CheckoutPaymentMethod.PROVIDER_WALLET && status != "Payment was not completed. Your order remains unpaid; retry securely or check your orders.") {
            Text(
                if (verified) "Your wallet payment has been confirmed." else status,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite },
            )
            OutlinedButton(enabled = !busy, onClick = ::verifyPaymentStatus, modifier = Modifier.fillMaxWidth()) {
                if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("Check payment status")
            }
        } else {
            val checkoutUrl = payment?.checkoutUrl
            if (checkoutUrl == null) {
                Text(
                    "Nantty could not prepare a secure payment page. Check payment status or return to checkout.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
                OutlinedButton(enabled = !busy, onClick = ::verifyPaymentStatus, modifier = Modifier.fillMaxWidth()) {
                    Text("Check payment status")
                }
            } else {
            Text(
                "You will leave Nantty and continue at ${Uri.parse(checkoutUrl).host}.",
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
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(checkoutUrl))
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
                Text(
                    when {
                        receipt.paymentMethod == CheckoutPaymentMethod.PROVIDER_WALLET -> "Use secure payment instead"
                        savedCardActionRequired -> "Continue with secure verification"
                        else -> "Open secure payment"
                    },
                )
            }
            OutlinedButton(
                enabled = !busy,
                onClick = ::verifyPaymentStatus,
            ) { if (busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("Check payment status") }
            CheckoutSecurePaymentFallbackAction(
                visible = savedCardChargeFailed && !usingHostedFallback,
                enabled = !busy,
                onClick = {
                        usingHostedFallback = true
                        savedCardChargeFailed = false
                        savedCardActionRequired = false
                        payment = null
                },
            )
            }
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
