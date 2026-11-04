package com.nantty.android.ui

import android.content.Intent
import android.net.Uri
import android.content.Context
import android.content.ContextWrapper
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.LifecycleOwner
import com.nantty.android.data.CheckoutAddress
import com.nantty.android.data.CheckoutAddressInput
import com.nantty.android.data.CheckoutAddressesResult
import com.nantty.android.data.CheckoutCartResult
import com.nantty.android.data.CheckoutReceipt
import com.nantty.android.data.CheckoutRepository
import com.nantty.android.data.HostedPayment
import com.nantty.android.data.HostedPaymentResult
import com.nantty.android.data.PaymentVerificationResult
import com.nantty.android.data.PlaceCheckoutResult
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.formatWalletAmount
import java.util.UUID
import java.util.concurrent.Executor

@Composable
internal fun CheckoutScreen(
    repository: CheckoutRepository,
    executor: Executor,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    onCheckoutCreated: (CheckoutReceipt) -> Unit,
) {
    var addresses by remember(repository) { mutableStateOf<List<CheckoutAddress>?>(null) }
    var selectedId by remember(repository) { mutableStateOf<String?>(null) }
    var cart by remember(repository) { mutableStateOf<com.nantty.android.data.CartSnapshot?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    var placing by remember(repository) { mutableStateOf(false) }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var showingAddressForm by remember(repository) { mutableStateOf(false) }
    var savingAddress by remember(repository) { mutableStateOf(false) }
    var addressSaveError by remember(repository) { mutableStateOf<String?>(null) }
    var generation by remember(repository) { mutableStateOf(0) }
    var checkoutKey by rememberSaveable { mutableStateOf(UUID.randomUUID().toString()) }
    val addressId = selectedId ?: addresses?.firstOrNull(CheckoutAddress::isDefault)?.id ?: addresses?.firstOrNull()?.id

    BackHandler(onBack = onBack)
    LaunchedEffect(repository, generation, addressId) {
        loading = true
        error = null
        executor.execute {
            val addressResult = if (addresses == null || generation > 0) repository.loadAddresses() else CheckoutAddressesResult.Success(addresses.orEmpty())
            val rows = (addressResult as? CheckoutAddressesResult.Success)?.addresses
            val selected = addressId ?: rows?.firstOrNull(CheckoutAddress::isDefault)?.id ?: rows?.firstOrNull()?.id
            val cartResult = if (selected != null) repository.quoteCart(selected) else null
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                when (addressResult) {
                    is CheckoutAddressesResult.Failure -> {
                        error = addressResult.message
                        if (addressResult.authenticationRequired) onAuthenticationRequired()
                    }
                    is CheckoutAddressesResult.Success -> {
                        addresses = rows.orEmpty()
                        if (selectedId == null) selectedId = selected
                        when (cartResult) {
                            is CheckoutCartResult.Success -> cart = cartResult.cart
                            is CheckoutCartResult.Failure -> {
                                error = cartResult.message
                                if (cartResult.authenticationRequired) onAuthenticationRequired()
                            }
                            null -> cart = null
                        }
                    }
                }
                loading = false
            }
        }
    }

    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to cart" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Spacer(Modifier.width(8.dp))
            Text("Checkout", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            IconButton(onClick = { generation++ }, enabled = !loading, modifier = Modifier.semantics { contentDescription = "Refresh checkout" }) {
                Icon(Icons.Default.Refresh, contentDescription = null)
            }
        }
        when {
            loading && addresses == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading checkout" })
            }
            else -> LazyColumn(
                Modifier.fillMaxSize().widthIn(max = 760.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (error != null) item { Text(error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
                item { Text("Delivery address", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold) }
                if (addresses.isNullOrEmpty()) {
                    item {
                        CheckoutInfoCard(
                            title = "Add a delivery address to continue",
                            body = "Add a delivery address so Nantty can calculate delivery and show your server-calculated total.",
                        )
                    }
                    item {
                        Button(onClick = { addressSaveError = null; showingAddressForm = true }, enabled = !loading) {
                            Text("Add delivery address")
                        }
                    }
                } else {
                    items(addresses.orEmpty(), key = CheckoutAddress::id) { address ->
                        Card(
                            onClick = { if (selectedId != address.id) { selectedId = address.id; cart = null; generation++ } },
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
                        ) {
                            Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                RadioButton(selected = address.id == addressId, onClick = null)
                                Column(Modifier.weight(1f).padding(start = 8.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                    Text(address.fullName + if (address.isDefault) " · Default" else "", fontWeight = FontWeight.Medium)
                                    Text(listOf(address.line1, address.line2, address.city, address.state, address.country).filter(String::isNotBlank).joinToString(", "), style = MaterialTheme.typography.bodyMedium)
                                    Text(address.phone, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                    item {
                        OutlinedButton(onClick = { addressSaveError = null; showingAddressForm = true }, enabled = !loading) {
                            Text("Add another address")
                        }
                    }
                }
                item { Text("Order summary", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold) }
                item {
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Server-calculated total", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            cart?.itemsTotal?.let { CheckoutAmountRow("Items", it) }
                            cart?.discounts?.takeIf { it.amountMinor > 0L }?.let { CheckoutAmountRow("Discounts", it, negative = true) }
                            cart?.storeCredit?.takeIf { it.amountMinor > 0L }?.let { CheckoutAmountRow("Store credit", it, negative = true) }
                            cart?.shipping?.let { CheckoutAmountRow("Delivery", it) }
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Total due", fontWeight = FontWeight.Bold)
                                Text(
                                    cart?.let { formatWalletAmount(WalletMoney(it.totalAmountMinor, it.currency)) }
                                        ?: if (loading) "Updating…" else "Select an address",
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                    }
                }
                item {
                    CheckoutInfoCard(
                        title = "Protected payment",
                        body = "This Android checkout uses Nantty escrow. Funds remain protected under the order flow; payment is not confirmed until Nantty verifies it.",
                    )
                }
                item {
                    Button(
                        onClick = {
                            val chosen = addressId ?: return@Button
                            if (placing || cart == null || cart?.lines.isNullOrEmpty()) return@Button
                            placing = true
                            error = null
                            executor.execute {
                                when (val result = repository.placeOrder(chosen, checkoutKey)) {
                                    is PlaceCheckoutResult.Success -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                        placing = false
                                        onCheckoutCreated(result.receipt)
                                    }
                                    is PlaceCheckoutResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                        placing = false
                                        error = result.message
                                        if (result.authenticationRequired) onAuthenticationRequired()
                                    }
                                }
                            }
                        },
                        enabled = !placing && !loading && addressId != null && cart?.lines?.isNotEmpty() == true && cart?.payableGroupCount?.let { it > 0 } == true,
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                    ) {
                        if (placing) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                        else Text("Continue to secure payment")
                    }
                }
            }
        }
    }
    if (showingAddressForm) {
        CheckoutAddressForm(
            repository = repository,
            executor = executor,
            saving = savingAddress,
            saveError = addressSaveError,
            onDismiss = { if (!savingAddress) showingAddressForm = false },
            onSave = { input: CheckoutAddressInput ->
                if (savingAddress) return@CheckoutAddressForm
                savingAddress = true
                addressSaveError = null
                executor.execute {
                    val outcome = runCatching { repository.createAddress(input) }
                    androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                        savingAddress = false
                        outcome.onSuccess { saved ->
                            addresses = (addresses.orEmpty().filterNot { it.id == saved.id } + saved)
                            selectedId = saved.id
                            cart = null
                            showingAddressForm = false
                            generation++
                        }.onFailure { addressSaveError = it.message ?: "Could not save this address. Check the details and try again." }
                    }
                }
            },
        )
    }
}

@Composable
private fun CheckoutAmountRow(label: String, amount: WalletMoney, negative: Boolean = false) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            (if (negative) "−" else "") + formatWalletAmount(amount),
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}

@Composable
internal fun CheckoutPaymentScreen(
    repository: CheckoutRepository,
    executor: Executor,
    receipt: CheckoutReceipt,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    onViewOrders: () -> Unit,
) {
    var payment by remember(receipt.payableOrderId) { mutableStateOf<HostedPayment?>(null) }
    var busy by remember(receipt.payableOrderId) { mutableStateOf(false) }
    var status by remember(receipt.payableOrderId) { mutableStateOf("Payment is not confirmed yet.") }
    var verified by rememberSaveable(receipt.payableOrderId) { mutableStateOf(false) }
    var paymentKey by rememberSaveable(receipt.payableOrderId) { mutableStateOf(UUID.randomUUID().toString()) }
    var awaitingProviderReturn by rememberSaveable(receipt.payableOrderId) { mutableStateOf(false) }
    var providerPagePausedApp by rememberSaveable(receipt.payableOrderId) { mutableStateOf(false) }
    val context = LocalContext.current
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
            when (val result = repository.verifyPayment(receipt.payableOrderId)) {
                PaymentVerificationResult.Paid -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    busy = false
                    status = "Payment verified by Nantty."
                    verified = true
                }
                PaymentVerificationResult.Pending -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    busy = false
                    status = "Payment is still processing. You can safely check again shortly."
                }
                PaymentVerificationResult.Failed -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    busy = false
                    status = "Payment was not completed. Your order remains unpaid; retry securely or check your orders."
                }
                is PaymentVerificationResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    busy = false
                    status = result.message
                    if (result.authenticationRequired) onAuthenticationRequired()
                }
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

    Column(
        Modifier.fillMaxSize().widthIn(max = 640.dp).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Order created", Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.size(12.dp))
        Text("${receipt.orderCount} ${if (receipt.orderCount == 1) "seller order" else "seller orders"} · ${formatWalletAmount(receipt.total)}", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.size(8.dp))
        Text(status, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.size(20.dp))
        if (verified) {
            Button(onClick = onViewOrders) { Text("View your orders") }
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

@Composable
private fun CheckoutInfoCard(title: String, body: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Text(body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
