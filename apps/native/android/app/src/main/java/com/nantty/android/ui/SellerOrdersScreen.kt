package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.size
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.SellerOrder
import com.nantty.android.data.SellerOrdersPage
import com.nantty.android.data.SellerOrdersRepository
import com.nantty.android.data.SellerOrdersResult
import com.nantty.android.data.SellerShipmentRepository
import com.nantty.android.data.DisputeRepository
import com.nantty.android.data.formatWalletAmount
import com.nantty.android.data.WalletMoney
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.concurrent.Executor

private enum class SellerOrderFilter(val status: String?, val label: String) {
    ALL(null, "All"), TO_SHIP("pending", "To ship"), SHIPPED("shipped", "Shipped"),
    DELIVERED("delivered", "Delivered"), DISPUTED("disputed", "Disputed"),
}

/** Seller order list and its detail destination. Server records remain authoritative. */
@Composable
internal fun SellerOrdersScreen(
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
    var selectedOrderId by rememberSaveable(repository) { mutableStateOf<String?>(null) }
    var selectedFilter by rememberSaveable(repository) { mutableStateOf(SellerOrderFilter.ALL) }
    var retryKey by rememberSaveable(repository) { mutableIntStateOf(0) }
    var result by remember(repository) { mutableStateOf<SellerOrdersResult<SellerOrdersPage>?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    val success = result as? SellerOrdersResult.Success<SellerOrdersPage>

    BackHandler(enabled = selectedOrderId != null) { selectedOrderId = null }
    selectedOrderId?.let { orderId ->
        SellerOrderDetailScreen(
            orderId = orderId,
            repository = repository,
            shipmentRepository = shipmentRepository,
            disputeRepository = disputeRepository,
            executor = executor,
            onBack = { selectedOrderId = null },
            onAuthenticationRequired = onAuthenticationRequired,
            onMessageBuyer = onMessageBuyer,
            onOpenBuyerProfile = onOpenBuyerProfile,
        )
        return
    }

    LaunchedEffect(repository, retryKey) {
        loading = true
        result = withContext(Dispatchers.IO) { repository.load() }
        loading = false
    }

    val orders = remember(success?.value?.orders, selectedFilter) {
        success?.value?.orders.orEmpty().filter { sellerOrderMatchesFilter(it.status, selectedFilter) }
    }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().widthIn(max = 960.dp).align(Alignment.CenterHorizontally).padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to seller workspace" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Text("Orders", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            IconButton(onClick = { retryKey++ }, modifier = Modifier.semantics { contentDescription = "Refresh seller orders" }) {
                Icon(Icons.Default.Refresh, contentDescription = null)
            }
        }
        androidx.compose.foundation.lazy.LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth().widthIn(max = 960.dp).align(Alignment.CenterHorizontally).padding(horizontal = 16.dp),
        ) {
            items(SellerOrderFilter.entries, key = SellerOrderFilter::name) { filter ->
                FilterChip(selected = selectedFilter == filter, onClick = { selectedFilter = filter }, label = { Text(filter.label) })
            }
        }
        when {
            loading && result == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    CircularProgressIndicator()
                    Text("Loading orders", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            result is SellerOrdersResult.Failure -> {
                val failure = result as SellerOrdersResult.Failure
                SellerOrdersMessage(
                    title = if (failure.authenticationRequired) "Sign in to continue" else "Orders are unavailable",
                    message = failure.message,
                    actionLabel = if (failure.authenticationRequired) "Sign in again" else "Retry",
                    onAction = if (failure.authenticationRequired) onAuthenticationRequired else ({ retryKey++; Unit }),
                )
            }
            orders.isEmpty() -> SellerOrdersMessage(
                title = if (selectedFilter == SellerOrderFilter.ALL) "No orders yet" else "No ${selectedFilter.label.lowercase()} orders",
                message = if (selectedFilter == SellerOrderFilter.ALL) "New buyer orders will appear here." else "Try another order filter.",
                actionLabel = if (selectedFilter == SellerOrderFilter.ALL) null else "Show all orders",
                onAction = if (selectedFilter == SellerOrderFilter.ALL) null else ({ selectedFilter = SellerOrderFilter.ALL }),
            )
            else -> LazyColumn(
                Modifier.fillMaxSize().widthIn(max = 960.dp).align(Alignment.CenterHorizontally),
            ) {
                items(orders, key = SellerOrder::id) { order ->
                    SellerOrderRow(order) { selectedOrderId = order.id }
                }
            }
        }
    }
}

@Composable
private fun SellerOrderRow(order: SellerOrder, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)
            .semantics { contentDescription = "Order ${order.orderNumber}, buyer ${order.buyer.name}, ${sellerOrderStatusLabel(order.status)}. View details" }
            .clickable(onClick = onClick),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                val firstLine = order.lines.firstOrNull()
                Box(
                    Modifier.size(52.dp)
                        .clip(MaterialTheme.shapes.medium)
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                ) {
                    firstLine?.imageUrl?.let { imageUrl ->
                        AsyncImage(
                            model = imageUrl,
                            contentDescription = firstLine.name.takeIf(String::isNotBlank)?.let { "Product image: $it" },
                            modifier = Modifier.fillMaxSize(),
                            contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                        )
                    }
                }
                Text(firstLine?.name ?: "Order ${order.orderNumber}", Modifier.weight(1f).padding(start = 12.dp), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                SellerOrderStatus(order.status)
            }
            Text("Buyer: ${order.buyer.name}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("${order.orderNumber} · ${order.lines.size} ${if (order.lines.size == 1) "item" else "items"}", Modifier.weight(1f), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(formatWalletAmount(WalletMoney(order.total.amountMinor, order.total.currency)), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
internal fun SellerOrderStatus(status: String) {
    val (label, container) = when (status) {
        "pending" -> "Unpaid" to MaterialTheme.colorScheme.surfaceVariant
        "paid" -> "To ship" to MaterialTheme.colorScheme.primaryContainer
        "new" -> "To process" to MaterialTheme.colorScheme.primaryContainer
        "processing" -> "Preparing" to MaterialTheme.colorScheme.primaryContainer
        "ready" -> "Ready to ship" to MaterialTheme.colorScheme.primaryContainer
        "shipped" -> "Shipped" to MaterialTheme.colorScheme.tertiaryContainer
        "delivered" -> "Delivered" to MaterialTheme.colorScheme.secondaryContainer
        "completed" -> "Completed" to MaterialTheme.colorScheme.secondaryContainer
        "disputed" -> "Disputed" to MaterialTheme.colorScheme.errorContainer
        "cancelled" -> "Cancelled" to MaterialTheme.colorScheme.errorContainer
        "returned" -> "Returned" to MaterialTheme.colorScheme.errorContainer
        "refunded" -> "Refunded" to MaterialTheme.colorScheme.errorContainer
        else -> "Status update" to MaterialTheme.colorScheme.surfaceVariant
    }
    Surface(color = container, shape = MaterialTheme.shapes.small) {
        Text(label, Modifier.padding(horizontal = 9.dp, vertical = 5.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurface)
    }
}

@Composable
internal fun SellerOrdersMessage(title: String, message: String, actionLabel: String? = null, onAction: (() -> Unit)? = null) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 36.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(message, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (actionLabel != null && onAction != null) TextButton(onClick = onAction) { Text(actionLabel) }
    }
}

private fun sellerOrderMatchesFilter(status: String, filter: SellerOrderFilter): Boolean = when (filter) {
    SellerOrderFilter.ALL -> true
    SellerOrderFilter.TO_SHIP -> status in setOf("paid", "new", "processing", "ready")
    else -> status == filter.status
}

private fun sellerOrderStatusLabel(status: String): String = when (status) {
    "new" -> "To process"
    "processing" -> "Preparing"
    "ready" -> "Ready to ship"
    "paid" -> "To ship"
    else -> status.replaceFirstChar(Char::uppercase)
}
