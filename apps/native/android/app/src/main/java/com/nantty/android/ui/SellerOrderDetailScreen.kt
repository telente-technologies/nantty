package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.BuyerDispute
import com.nantty.android.data.DisputeRepository
import com.nantty.android.data.DisputeRepositoryResult
import com.nantty.android.data.OrderEscrowDetail
import com.nantty.android.data.SellerOrder
import com.nantty.android.data.SellerOrderMoney
import com.nantty.android.data.SellerOrdersRepository
import com.nantty.android.data.SellerOrdersResult
import com.nantty.android.data.SellerShipmentInput
import com.nantty.android.data.SellerShipmentRepository
import com.nantty.android.data.SellerShipmentResult
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.formatWalletAmount
import java.net.URI
import java.util.UUID
import java.util.concurrent.Executor

@Composable
internal fun SellerOrderDetailScreen(
    orderId: String,
    repository: SellerOrdersRepository,
    shipmentRepository: SellerShipmentRepository,
    disputeRepository: DisputeRepository,
    executor: Executor,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    onMessageBuyer: (String) -> Unit,
    onOpenBuyerProfile: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var result by remember(orderId) { mutableStateOf<SellerOrdersResult<SellerOrder>?>(null) }
    var retryGeneration by rememberSaveable(orderId) { mutableIntStateOf(0) }
    var escrowResult by remember(orderId) { mutableStateOf<DisputeRepositoryResult<OrderEscrowDetail>?>(null) }
    var showingDisputeId by rememberSaveable(orderId) { mutableStateOf<String?>(null) }
    var showingShipmentForm by rememberSaveable(orderId) { mutableStateOf(false) }
    var courier by rememberSaveable(orderId) { mutableStateOf("") }
    var trackingNumber by rememberSaveable(orderId) { mutableStateOf("") }
    var trackingUrl by rememberSaveable(orderId) { mutableStateOf("") }
    var shipmentKey by rememberSaveable(orderId) { mutableStateOf(UUID.randomUUID().toString()) }
    var shipmentResult by remember(orderId) { mutableStateOf<SellerShipmentResult?>(null) }
    var submittingShipment by remember(orderId) { mutableStateOf(false) }
    val orderResult = result as? SellerOrdersResult.Success<SellerOrder>
    val order = orderResult?.value

    BackHandler(enabled = showingDisputeId != null) { showingDisputeId = null }
    showingDisputeId?.let { disputeId ->
        BuyerDisputeDetailScreen(
            disputeId = disputeId,
            repository = disputeRepository,
            executor = executor,
            onBack = { showingDisputeId = null },
            onReauthenticate = onAuthenticationRequired,
        )
        return
    }

    LaunchedEffect(repository, orderId, retryGeneration) {
        result = null
        result = withContextSellerIO { repository.loadDetail(orderId) }
    }
    LaunchedEffect(disputeRepository, orderId, order?.paymentMode) {
        escrowResult = null
        if (order != null && order.paymentMode != "direct") {
            escrowResult = withContextSellerIO { disputeRepository.loadEscrowForOrder(orderId) }
        }
    }

    Column(modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().padding(start = 8.dp, end = 12.dp, top = 8.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back to orders")
            }
            Text(order?.let { "Order ${it.orderNumber}" } ?: "Order details", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            IconButton(onClick = { retryGeneration++ }) {
                Icon(Icons.Default.Refresh, contentDescription = "Refresh order")
            }
        }
        when {
            result == null -> Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                CircularProgressIndicator()
                Spacer(Modifier.height(12.dp))
                Text("Loading order details")
            }
            result is SellerOrdersResult.Failure -> {
                val failure = result as SellerOrdersResult.Failure
                SellerOrdersMessage(
                    title = if (failure.authenticationRequired) "Sign in to continue" else "Order unavailable",
                    message = failure.message,
                    actionLabel = if (failure.authenticationRequired) "Sign in again" else "Retry",
                    onAction = if (failure.authenticationRequired) onAuthenticationRequired else ({ retryGeneration++; Unit }),
                )
            }
            order != null -> SellerOrderDetailContent(
                order = order,
                escrow = (escrowResult as? DisputeRepositoryResult.Success<OrderEscrowDetail>)?.value,
                shipmentSubmitting = submittingShipment,
                onMarkShipped = { showingShipmentForm = true },
                onMessageBuyer = { onMessageBuyer(order.buyer.id) },
                onOpenBuyerProfile = { onOpenBuyerProfile(order.buyer.id) },
                onViewDispute = { disputeId -> showingDisputeId = disputeId },
            )
        }
    }

    if (showingShipmentForm && order != null) {
        val trackingValid = isOptionalSellerTrackingUrlValid(trackingUrl)
        val numberValid = trackingNumber.trim().matches(Regex("^[A-Za-z0-9-]{4,40}$"))
        val courierValid = courier.trim().length in 2..60
        AlertDialog(
            onDismissRequest = { if (!submittingShipment) showingShipmentForm = false },
            title = { Text("Mark as shipped") },
            text = {
                Column(Modifier.imePadding().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Add the courier and tracking number so the buyer can follow the parcel. Nantty verifies the shipment before changing the order status.", style = MaterialTheme.typography.bodyMedium)
                    OutlinedTextField(courier, { courier = it; shipmentKey = UUID.randomUUID().toString(); shipmentResult = null }, label = { Text("Courier") }, singleLine = true, enabled = !submittingShipment)
                    OutlinedTextField(trackingNumber, { trackingNumber = it; shipmentKey = UUID.randomUUID().toString(); shipmentResult = null }, label = { Text("Tracking number") }, singleLine = true, enabled = !submittingShipment, supportingText = { Text("4–40 letters, numbers or hyphens") })
                    OutlinedTextField(trackingUrl, { trackingUrl = it; shipmentKey = UUID.randomUUID().toString(); shipmentResult = null }, label = { Text("Tracking link (optional)") }, singleLine = true, enabled = !submittingShipment, supportingText = { if (!trackingValid) Text("Enter a valid HTTPS link up to 300 characters.", color = MaterialTheme.colorScheme.error) })
                    (shipmentResult as? SellerShipmentResult.Failure)?.let { failure ->
                        Text(failure.message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }
                }
            },
            confirmButton = {
                TextButton(
                    enabled = !submittingShipment && courierValid && numberValid && trackingValid,
                    onClick = {
                        submittingShipment = true
                        val input = SellerShipmentInput(courier.trim(), trackingNumber.trim(), trackingUrl.trim().ifEmpty { null })
                        executor.execute {
                            val shipped = shipmentRepository.markAsShipped(order.id, input, shipmentKey)
                            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                shipmentResult = shipped
                                submittingShipment = false
                                when (shipped) {
                                    is SellerShipmentResult.Success -> {
                                        result = SellerOrdersResult.Success(shipped.order)
                                        showingShipmentForm = false
                                    }
                                    is SellerShipmentResult.Failure -> if (shipped.authenticationRequired) onAuthenticationRequired()
                                }
                            }
                        }
                    },
                ) { Text(if (submittingShipment) "Sending…" else "Confirm shipment") }
            },
            dismissButton = { TextButton(enabled = !submittingShipment, onClick = { showingShipmentForm = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun SellerOrderDetailContent(
    order: SellerOrder,
    escrow: OrderEscrowDetail?,
    shipmentSubmitting: Boolean,
    onMarkShipped: () -> Unit,
    onMessageBuyer: () -> Unit,
    onOpenBuyerProfile: () -> Unit,
    onViewDispute: (String) -> Unit,
) {
    val awaitingShipment = order.status in setOf("paid", "new", "processing", "ready")
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        escrow?.let { SellerEscrowSummary(it) }
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${order.orderNumber} · ${order.invoiceNumber}", Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    SellerOrderStatus(order.status)
                }
                Text("Buyer: ${order.buyer.name} (@${order.buyer.username})", style = MaterialTheme.typography.bodyMedium)
                Text("Placed ${formatSellerOrderDate(order.createdAt)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (order.escrowStatus == "held") {
                    Text(
                        if (order.status == "disputed") "The buyer opened a dispute. Escrow release is paused." else "Funds remain held in escrow until the buyer confirms delivery.",
                        color = MaterialTheme.colorScheme.tertiary,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }
        if (awaitingShipment && order.fulfilment == null) {
            Button(onClick = onMarkShipped, enabled = !shipmentSubmitting, modifier = Modifier.fillMaxWidth()) {
                if (shipmentSubmitting) CircularProgressIndicator()
                else Text("Mark as shipped")
            }
        }
        escrow?.disputeId?.let { disputeId ->
            OutlinedButton(onClick = { onViewDispute(disputeId) }, modifier = Modifier.fillMaxWidth()) { Text("View dispute") }
        }
        escrow?.let { detail ->
            SellerOrderSection(title = "Escrow progress") { SellerEscrowTimeline(detail) }
        }
        order.fulfilment?.let { shipment ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text("Shipment", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text(shipment.courier)
                    Text("Tracking number: ${shipment.trackingNumber}")
                    shipment.trackingUrl?.let { Text("Tracking link: $it", color = MaterialTheme.colorScheme.primary) }
                }
            }
        }
        SellerOrderSection(title = "Items") {
            order.lines.forEach { line ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text("${line.quantity} × ${line.name}", style = MaterialTheme.typography.bodyMedium)
                        line.variantTitle.takeIf(String::isNotBlank)?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                    Text(formatWalletAmount(WalletMoney(line.lineTotal.amountMinor, line.lineTotal.currency)), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                }
            }
            SellerOrderAmountRow("Subtotal", order.subtotal)
            if (order.discount.amountMinor != 0L) SellerOrderAmountRow("Discount", order.discount, negative = true)
            if (order.storeCredit.amountMinor != 0L) SellerOrderAmountRow("Store credit", order.storeCredit, negative = true)
            SellerOrderAmountRow("Shipping", order.shippingFee)
            SellerOrderAmountRow("Order total", order.total, strong = true)
            SellerOrderAmountRow("Seller payout", order.sellerPayout)
        }
        SellerOrderSection(title = "Delivery address") {
            Text(order.shippingAddress.recipientName, fontWeight = FontWeight.Medium)
            Text(order.shippingAddress.phone)
            Text(listOf(order.shippingAddress.line1, order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.country).filter(String::isNotBlank).joinToString(", "))
        }
        SellerOrderSection(title = "Activity") {
            if (order.timeline.isEmpty()) Text("No order updates yet.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            order.timeline.forEach { event ->
                Text(event.summary, style = MaterialTheme.typography.bodyMedium)
                Text("${event.actorName?.let { "$it · " }.orEmpty()}${formatSellerOrderDate(event.createdAt)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        OutlinedButton(onClick = onMessageBuyer, modifier = Modifier.fillMaxWidth()) { Text("Message buyer") }
        OutlinedButton(onClick = onOpenBuyerProfile, modifier = Modifier.fillMaxWidth()) { Text("View buyer profile") }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun SellerOrderSection(title: String, content: @Composable () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            content()
        }
    }
}

@Composable
private fun SellerOrderAmountRow(label: String, amount: SellerOrderMoney, negative: Boolean = false, strong: Boolean = false) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = if (strong) MaterialTheme.typography.titleSmall else MaterialTheme.typography.bodySmall, fontWeight = if (strong) FontWeight.SemiBold else FontWeight.Normal)
        Text((if (negative) "−" else "") + formatWalletAmount(WalletMoney(amount.amountMinor, amount.currency)), style = if (strong) MaterialTheme.typography.titleSmall else MaterialTheme.typography.bodySmall, fontWeight = if (strong) FontWeight.SemiBold else FontWeight.Normal)
    }
}

private suspend fun <T> withContextSellerIO(block: () -> T): T = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { block() }

private fun isOptionalSellerTrackingUrlValid(value: String): Boolean {
    val normalized = value.trim()
    if (normalized.isEmpty()) return true
    if (normalized.length > 300 || normalized.any(Char::isWhitespace)) return false
    val uri = runCatching { URI(normalized) }.getOrNull() ?: return false
    return uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank() && uri.rawUserInfo == null
}

private fun formatSellerOrderDate(value: String): String = runCatching {
    java.time.Instant.parse(value).atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("MMM d, yyyy", java.util.Locale.getDefault()))
}.getOrDefault(value)
