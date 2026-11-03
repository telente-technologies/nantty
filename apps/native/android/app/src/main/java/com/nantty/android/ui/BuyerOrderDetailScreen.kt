package com.nantty.android.ui

import android.content.Intent
import android.net.Uri
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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.formatWalletAmount
import java.util.concurrent.Executor

@Composable
internal fun BuyerOrderDetailScreen(
    orderId: String,
    repository: BuyerOrdersRepository,
    executor: Executor,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var result by remember(orderId) { mutableStateOf<BuyerOrderDetailResult?>(null) }
    var retry by remember(orderId) { mutableStateOf(0) }
    var generation by remember(orderId) { mutableStateOf(0) }
    LaunchedEffect(orderId, retry) {
        val request = ++generation
        result = null
        executor.execute {
            val loaded = repository.loadDetail(orderId)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (generation == request) result = loaded
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
            is BuyerOrderDetailResult.Success -> BuyerOrderDetailContent(current.order)
        }
    }
}

@Composable
private fun BuyerOrderDetailContent(order: BuyerOrderDetail) {
    val context = LocalContext.current
    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
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
                    shipment.trackingUrl?.let { trackingUrl ->
                        TextButton(onClick = {
                            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(trackingUrl))) }
                        }) {
                            Text("Track shipment")
                        }
                    }
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
