package com.nantty.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.BuyerOrderDetail
import com.nantty.android.data.BuyerReturnsRepository
import com.nantty.android.data.ProductReviewsRepository
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.buyerCanCancelOrder
import com.nantty.android.data.buyerCanConfirmReceipt
import com.nantty.android.data.formatWalletAmount
import java.util.concurrent.Executor

@Composable
internal fun BuyerOrderDetailContent(
    order: BuyerOrderDetail,
    returnsRepository: BuyerReturnsRepository?,
    orderExecutor: Executor,
    reviewRepository: ProductReviewsRepository?,
    reviewExecutor: Executor,
    onAuthenticationRequired: () -> Unit,
    receiptConfirmed: Boolean,
    confirmingReceipt: Boolean,
    cancellingOrder: Boolean,
    refreshError: String?,
    canOpenDispute: Boolean,
    existingDisputeId: String?,
    onConfirmReceipt: () -> Unit,
    onCancelOrder: () -> Unit,
    onOpenDispute: () -> Unit,
    onViewDispute: (String) -> Unit,
    onOpenStore: () -> Unit,
    onOpenProduct: (String) -> Unit,
    onCheckPayment: () -> Unit,
    onOpenSupport: () -> Unit,
    supportAvailable: Boolean,
    contactingSeller: Boolean,
    contactSellerFailure: String?,
    contactSellerAvailable: Boolean,
    onContactSeller: () -> Unit,
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
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(order.storeName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        TextButton(onClick = onOpenStore) { Text("Visit store") }
                    }
                    Text("${order.reference} · ${buyerOrderStatusLabel(order.status)}", color = MaterialTheme.colorScheme.secondary)
                    Text("Payment: ${order.paymentStatus} · ${order.paymentMode}", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        if (order.status == "pending") {
            item { Button(onClick = onCheckPayment, modifier = Modifier.fillMaxWidth()) { Text("Check payment") } }
        }
        item { Text("Items", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold) }
        items(order.items) { item ->
            Row(
                Modifier.fillMaxWidth().then(
                    item.productId?.let { productId ->
                        Modifier.clickable(role = Role.Button) { onOpenProduct(productId) }
                            .semantics { contentDescription = "View ${item.name} product" }
                    } ?: Modifier,
                ),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("${item.quantity} × ${item.name}", Modifier.weight(1f))
                item.variant?.let { Text(it, color = MaterialTheme.colorScheme.secondary) }
            }
        }
        if (returnsRepository != null) item {
            BuyerReturnRequestSection(
                order = order,
                repository = returnsRepository,
                executor = orderExecutor,
                onAuthenticationRequired = onAuthenticationRequired,
            )
        }
        if (reviewRepository != null) {
            item {
                BuyerOrderReviewSection(
                    status = order.status,
                    products = order.items,
                    repository = reviewRepository,
                    executor = reviewExecutor,
                    onAuthenticationRequired = onAuthenticationRequired,
                )
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
        order.escrowReleaseAt?.let { releaseAt ->
            item { Text("Escrow release date: ${formatBuyerOrderDate(releaseAt)}", color = MaterialTheme.colorScheme.secondary) }
        }
        order.promotionIssue?.let { issue -> item { Text(issue, color = MaterialTheme.colorScheme.error) } }
        if (buyerCanConfirmReceipt(order.status) && !receiptConfirmed) {
            item { Button(onClick = onConfirmReceipt, enabled = !confirmingReceipt, modifier = Modifier.fillMaxWidth()) { Text("Confirm receipt") } }
        }
        if (buyerCanCancelOrder(order.status)) {
            item {
                OutlinedButton(onClick = onCancelOrder, enabled = !cancellingOrder, modifier = Modifier.fillMaxWidth()) {
                    Text(if (cancellingOrder) "Cancelling…" else "Cancel order")
                }
            }
        }
        if (existingDisputeId != null) {
            item { OutlinedButton(onClick = { onViewDispute(existingDisputeId) }, modifier = Modifier.fillMaxWidth()) { Text("View dispute") } }
        } else if (canOpenDispute) {
            item { OutlinedButton(onClick = onOpenDispute, modifier = Modifier.fillMaxWidth()) { Text("Open a dispute") } }
        }
        item {
            OutlinedButton(
                onClick = onContactSeller,
                enabled = !contactingSeller && contactSellerAvailable,
                modifier = Modifier.fillMaxWidth(),
            ) { Text(if (contactingSeller) "Opening conversation…" else "Contact seller") }
            if (contactSellerFailure != null) {
                Text(contactSellerFailure, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
        }
        item { OutlinedButton(onClick = onOpenSupport, enabled = supportAvailable, modifier = Modifier.fillMaxWidth()) { Text("Get help with this order") } }
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
