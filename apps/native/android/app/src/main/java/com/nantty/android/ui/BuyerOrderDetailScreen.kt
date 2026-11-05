package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.BuyerOrderDetail
import com.nantty.android.data.BuyerOrderDetailResult
import com.nantty.android.data.BuyerOrderReceiptResult
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.DisputeRepository
import com.nantty.android.data.DisputeRepositoryResult
import com.nantty.android.data.OrderEscrowDetail
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.buyerCanOpenDispute
import com.nantty.android.data.buyerCanConfirmReceipt
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.formatWalletAmount
import java.util.concurrent.Executor
import java.util.UUID

@Composable
internal fun BuyerOrderDetailScreen(
    orderId: String,
    repository: BuyerOrdersRepository,
    executor: Executor,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    modifier: Modifier = Modifier,
    disputeRepository: DisputeRepository? = null,
    privateMediaUploadsRepository: CreatorSampleMediaRepository? = null,
) {
    var result by remember(orderId) { mutableStateOf<BuyerOrderDetailResult?>(null) }
    var retry by remember(orderId) { mutableIntStateOf(0) }
    var generation by remember(orderId) { mutableIntStateOf(0) }
    var showConfirmDialog by remember(orderId) { mutableStateOf(false) }
    var confirmingReceipt by remember(orderId) { mutableStateOf(false) }
    var receiptIdempotencyKey by remember(orderId) { mutableStateOf(UUID.randomUUID().toString()) }
    var receiptConfirmed by remember(orderId) { mutableStateOf(false) }
    var receiptError by remember(orderId) { mutableStateOf<BuyerOrderReceiptResult.Failure?>(null) }
    var refreshError by remember(orderId) { mutableStateOf<String?>(null) }
    var escrowResult by remember(orderId) { mutableStateOf<DisputeRepositoryResult<OrderEscrowDetail>?>(null) }
    var showOpenDispute by rememberSaveable(orderId) { mutableStateOf(false) }
    var activeDisputeId by rememberSaveable(orderId) { mutableStateOf<String?>(null) }

    if (activeDisputeId != null && disputeRepository != null) {
        BuyerDisputeDetailScreen(
            disputeId = activeDisputeId!!,
            repository = disputeRepository,
            executor = executor,
            onBack = { activeDisputeId = null; retry += 1 },
            onReauthenticate = onAuthenticationRequired,
        )
        return
    }
    if (showOpenDispute && disputeRepository != null && privateMediaUploadsRepository != null) {
        BuyerOpenDisputeScreen(
            orderId = orderId,
            repository = disputeRepository,
            mediaRepository = privateMediaUploadsRepository,
            executor = executor,
            onBack = { showOpenDispute = false },
            onReauthenticate = onAuthenticationRequired,
            onCreated = { disputeId ->
                showOpenDispute = false
                activeDisputeId = disputeId
                retry += 1
            },
        )
        return
    }

    LaunchedEffect(orderId, retry, disputeRepository) {
        val request = ++generation
        result = null
        executor.execute {
            val loaded = repository.loadDetail(orderId)
            val escrow = disputeRepository?.loadEscrowForOrder(orderId)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (generation == request) {
                    result = loaded
                    escrowResult = escrow
                }
            }
        }
    }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 8.dp, end = 16.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to orders" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Spacer(Modifier.width(8.dp))
            Text("Order details", Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }
        when (val current = result) {
            null -> Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                CircularProgressIndicator()
                Text("Loading order details", Modifier.padding(top = 12.dp), color = MaterialTheme.colorScheme.secondary)
            }
            is BuyerOrderDetailResult.Failure -> BuyerOrdersMessage(
                title = if (current.authenticationRequired) "Sign in to continue" else "Order unavailable",
                message = current.message,
                action = if (current.authenticationRequired) onAuthenticationRequired else ({ retry += 1 }),
                actionLabel = if (current.authenticationRequired) "Sign in again" else "Retry",
            )
            is BuyerOrderDetailResult.Success -> {
                BuyerOrderDetailContent(
                    order = current.order,
                    receiptConfirmed = receiptConfirmed,
                    confirmingReceipt = confirmingReceipt,
                    refreshError = refreshError,
                    canOpenDispute = buyerCanOpenDispute(
                        current.order.status,
                        current.order.paymentMode == "direct",
                        (escrowResult as? DisputeRepositoryResult.Success)?.value,
                    ),
                    existingDisputeId = (escrowResult as? DisputeRepositoryResult.Success)?.value?.disputeId,
                    onConfirmReceipt = { showConfirmDialog = true },
                    onOpenDispute = { showOpenDispute = true },
                    onViewDispute = { disputeId -> activeDisputeId = disputeId },
                    onRefreshAfterConfirmation = {
                        val request = ++generation
                        refreshError = null
                        executor.execute {
                            val loaded = repository.loadDetail(orderId)
                            val escrow = disputeRepository?.loadEscrowForOrder(orderId)
                            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                escrowResult = escrow
                                if (generation == request) {
                                    when (loaded) {
                                        is BuyerOrderDetailResult.Success -> result = loaded
                                        is BuyerOrderDetailResult.Failure -> refreshError = loaded.message
                                    }
                                }
                            }
                        }
                    },
                )
            }
        }
    }

    val displayedOrder = (result as? BuyerOrderDetailResult.Success)?.order
    if (showConfirmDialog && displayedOrder?.let { buyerCanConfirmReceipt(it.status) } == true && !receiptConfirmed) {
        AlertDialog(
            onDismissRequest = { if (!confirmingReceipt) showConfirmDialog = false },
            title = { Text("Confirm you received it?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(buyerReceiptConfirmationMessage(displayedOrder.paymentMode, displayedOrder.storeName))
                    receiptError?.let { Text(it.message, color = MaterialTheme.colorScheme.error) }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = !confirmingReceipt && receiptError?.authenticationRequired != true,
                    onClick = {
                        if (confirmingReceipt || !buyerCanConfirmReceipt(displayedOrder.status)) return@TextButton
                        confirmingReceipt = true
                        receiptError = null
                        executor.execute {
                            when (val confirmed = repository.confirmReceipt(orderId, receiptIdempotencyKey)) {
                                is BuyerOrderReceiptResult.Failure -> androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                    confirmingReceipt = false
                                    receiptError = confirmed
                                }
                                is BuyerOrderReceiptResult.Success -> {
                                    val refreshed = repository.loadDetail(orderId)
                                    androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                        confirmingReceipt = false
                                        showConfirmDialog = false
                                        receiptConfirmed = confirmed.order.status == "completed"
                                        when (refreshed) {
                                            is BuyerOrderDetailResult.Success -> {
                                                result = refreshed
                                                refreshError = null
                                            }
                                            is BuyerOrderDetailResult.Failure -> {
                                                result = BuyerOrderDetailResult.Success(confirmed.order)
                                                refreshError = refreshed.message
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                ) { Text(if (confirmingReceipt) "Confirming…" else "Yes, release payment") }
            },
            dismissButton = {
                TextButton(
                    enabled = !confirmingReceipt,
                    onClick = {
                        if (receiptError?.authenticationRequired == true) onAuthenticationRequired()
                        showConfirmDialog = false
                    },
                ) { Text(if (receiptError?.authenticationRequired == true) "Sign in again" else "Cancel") }
            },
        )
    }
}

internal fun buyerReceiptConfirmationMessage(paymentMode: String, storeName: String): String =
    if (paymentMode == "direct") {
        "Only confirm if everything arrived as described."
    } else {
        "Only confirm if everything arrived as described. $storeName will be paid right away and this can't be undone."
    }

@Composable
private fun BuyerOrderDetailContent(
    order: BuyerOrderDetail,
    receiptConfirmed: Boolean,
    confirmingReceipt: Boolean,
    refreshError: String?,
    canOpenDispute: Boolean,
    existingDisputeId: String?,
    onConfirmReceipt: () -> Unit,
    onOpenDispute: () -> Unit,
    onViewDispute: (String) -> Unit,
    onRefreshAfterConfirmation: () -> Unit,
) {
    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (receiptConfirmed && refreshError != null) {
            item {
                DetailSection("Receipt confirmed") {
                    Text("Your confirmation was received, but the latest order status couldn't be loaded.")
                    TextButton(onClick = onRefreshAfterConfirmation) { Text("Refresh order") }
                }
            }
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(order.storeName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text("${order.reference} · ${buyerOrderStatusLabel(order.status)}", color = MaterialTheme.colorScheme.secondary)
                    Text("Payment: ${order.paymentStatus} · ${order.paymentMode}", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        item { Text("Items", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold) }
        items(order.items) { item ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${item.quantity} × ${item.name}", Modifier.weight(1f))
                item.variant?.let { Text(it, color = MaterialTheme.colorScheme.secondary) }
            }
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    MoneyLine("Subtotal", order.subtotalMinor, order.currency)
                    if (order.discountMinor > 0) MoneyLine("Discount", -order.discountMinor, order.currency)
                    if (order.storeCreditMinor > 0) MoneyLine("Store credit", -order.storeCreditMinor, order.currency)
                    MoneyLine("Shipping", order.shippingMinor, order.currency)
                    MoneyLine("Total", order.totalMinor, order.currency, bold = true)
                }
            }
        }
        order.shipment?.let { shipment ->
            item {
                DetailSection("Shipment") {
                    Text(shipment.courierName.ifBlank { "Courier" })
                    if (shipment.trackingNumber.isNotBlank()) Text("Tracking: ${shipment.trackingNumber}")
                    Text("Delivery updates are shown here in Nantty.", style = MaterialTheme.typography.bodySmall)
                    Text("Shipped ${formatBuyerOrderDate(shipment.shippedAt)}")
                    shipment.estimatedDeliveryAt?.let { Text("Estimated delivery ${formatBuyerOrderDate(it)}") }
                }
            }
        }
        order.delivery?.let { delivery ->
            item {
                DetailSection("Delivery") {
                    Text("Status: ${delivery.status}")
                    delivery.riderName?.let { Text("Rider: $it") }
                    delivery.riderPhone?.let { Text("Rider phone: $it") }
                    delivery.estimatedDeliveryAt?.let { Text("Estimated delivery ${formatBuyerOrderDate(it)}") }
                    if (delivery.attempts > 0) Text("Delivery attempts: ${delivery.attempts}")
                    delivery.lastAttemptNote?.let { Text(it) }
                }
            }
        }
        order.escrowReleaseAt?.let { releaseAt -> item { Text("Escrow release date: ${formatBuyerOrderDate(releaseAt)}", color = MaterialTheme.colorScheme.secondary) } }
        order.promotionIssue?.let { issue -> item { Text(issue, color = MaterialTheme.colorScheme.error) } }
        if (buyerCanConfirmReceipt(order.status) && !receiptConfirmed) {
            item {
                Button(
                    onClick = onConfirmReceipt,
                    enabled = !confirmingReceipt,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Confirm receipt") }
            }
        }
        if (existingDisputeId != null) {
            item {
                OutlinedButton(onClick = { onViewDispute(existingDisputeId) }, modifier = Modifier.fillMaxWidth()) {
                    Text("View dispute")
                }
            }
        } else if (canOpenDispute) {
            item {
                OutlinedButton(onClick = onOpenDispute, modifier = Modifier.fillMaxWidth()) {
                    Text("Open a dispute")
                }
            }
        }
    }
}

@Composable
private fun MoneyLine(label: String, amountMinor: Long, currency: String, bold: Boolean = false) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal)
        Text(formatWalletAmount(WalletMoney(amountMinor, currency)), fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal)
    }
}

@Composable
private fun DetailSection(title: String, content: @Composable () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            content()
        }
    }
}
