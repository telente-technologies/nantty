package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import com.nantty.android.data.BuyerOrder
import com.nantty.android.data.BuyerOrderFilter
import com.nantty.android.data.BuyerOrdersPage
import com.nantty.android.data.BuyerOrdersRepository
import com.nantty.android.data.BuyerOrdersResult
import com.nantty.android.data.appendUniqueBuyerOrders
import com.nantty.android.data.formatWalletAmount
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.concurrent.Executor

@Composable
internal fun BuyerOrdersScreen(
    repository: BuyerOrdersRepository,
    executor: Executor,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var selectedFilter by rememberSaveable(repository) { mutableStateOf(BuyerOrderFilter.ALL) }
    var selectedOrderId by rememberSaveable(repository) { mutableStateOf<String?>(null) }
    var result by remember(repository) { mutableStateOf<BuyerOrdersResult?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    var loadingMore by remember(repository) { mutableStateOf(false) }
    var loadMoreFailure by remember(repository) { mutableStateOf<BuyerOrdersResult.Failure?>(null) }
    var retryGeneration by remember(repository) { mutableStateOf(0) }
    var requestGeneration by remember(repository) { mutableStateOf(0) }
    val success = result as? BuyerOrdersResult.Success

    BackHandler(enabled = selectedOrderId != null) { selectedOrderId = null }

    selectedOrderId?.let { orderId ->
        BuyerOrderDetailScreen(
            orderId = orderId,
            repository = repository,
            executor = executor,
            onBack = { selectedOrderId = null },
            onAuthenticationRequired = onAuthenticationRequired,
        )
        return
    }

    LaunchedEffect(repository, selectedFilter, retryGeneration) {
        val generation = ++requestGeneration
        loading = true
        loadingMore = false
        loadMoreFailure = null
        result = null
        executor.execute {
            val loaded = repository.load(selectedFilter)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (requestGeneration == generation) {
                    result = loaded
                    loading = false
                }
            }
        }
    }

    fun loadMore() {
        val page = (result as? BuyerOrdersResult.Success)?.page ?: return
        val cursor = page.nextCursor ?: return
        if (loadingMore || loading) return
        val generation = requestGeneration
        loadingMore = true
        loadMoreFailure = null
        executor.execute {
            val next = repository.load(selectedFilter, cursor)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (requestGeneration == generation) {
                    when (next) {
                        is BuyerOrdersResult.Failure -> loadMoreFailure = next
                        is BuyerOrdersResult.Success -> {
                            val current = (result as? BuyerOrdersResult.Success)?.page ?: page
                            result = BuyerOrdersResult.Success(
                                BuyerOrdersPage(appendUniqueBuyerOrders(current.orders, next.page.orders), next.page.nextCursor),
                            )
                        }
                    }
                    loadingMore = false
                }
            }
        }
    }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 8.dp, end = 12.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Spacer(Modifier.width(8.dp))
            Text("My orders", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            IconButton(
                onClick = { retryGeneration += 1 },
                modifier = Modifier.semantics { contentDescription = "Refresh orders" },
            ) { Icon(Icons.Default.Refresh, contentDescription = null) }
        }

        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        ) {
            items(BuyerOrderFilter.entries, key = BuyerOrderFilter::name) { filter ->
                FilterChip(
                    selected = selectedFilter == filter,
                    onClick = { if (selectedFilter != filter) selectedFilter = filter },
                    label = { Text(filter.label) },
                )
            }
        }

        when {
            loading && result == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    CircularProgressIndicator()
                    Text("Loading your orders", color = MaterialTheme.colorScheme.secondary)
                }
            }
            result is BuyerOrdersResult.Failure && success == null -> {
                val failure = result as BuyerOrdersResult.Failure
                BuyerOrdersMessage(
                    title = if (failure.authenticationRequired) "Sign in to continue" else "Orders are unavailable",
                    message = failure.message,
                    action = if (failure.authenticationRequired) onAuthenticationRequired else ({ retryGeneration += 1 }),
                    actionLabel = if (failure.authenticationRequired) "Sign in again" else "Retry",
                )
            }
            success != null && success.page.orders.isEmpty() -> BuyerOrdersMessage(
                title = if (selectedFilter == BuyerOrderFilter.ALL) "No orders yet" else "No ${selectedFilter.label.lowercase()} orders",
                message = "Orders you place on Nantty will appear here.",
            )
            success != null -> LazyColumn(Modifier.fillMaxSize()) {
                items(success.page.orders, key = BuyerOrder::id) { order -> BuyerOrderRow(order) { selectedOrderId = order.id } }
                item(key = "buyer-orders-pagination") {
                    when {
                        loadingMore -> Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading more orders" })
                        }
                        loadMoreFailure != null -> Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Couldn't load the next page.", color = MaterialTheme.colorScheme.error)
                            val failure = loadMoreFailure
                            TextButton(onClick = {
                                if (failure?.authenticationRequired == true) onAuthenticationRequired() else loadMore()
                            }) { Text(if (failure?.authenticationRequired == true) "Sign in again" else "Try again") }
                        }
                        success.page.nextCursor != null -> TextButton(
                            onClick = ::loadMore,
                            modifier = Modifier.fillMaxWidth().padding(12.dp),
                        ) { Text("Load more orders") }
                    }
                }
            }
        }
    }
}

@Composable
private fun BuyerOrderRow(order: BuyerOrder, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp).semantics { contentDescription = "Order ${order.reference}, ${buyerOrderStatusLabel(order.status)}. View details" }.clickable(onClick = onClick),
        color = MaterialTheme.colorScheme.surface,
        shape = MaterialTheme.shapes.large,
        tonalElevation = 1.dp,
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(order.storeName, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(buyerOrderStatusLabel(order.status), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelMedium)
            }
            Text(order.itemSummary, style = MaterialTheme.typography.bodyMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("${order.reference} · ${formatBuyerOrderDate(order.createdAt)}", Modifier.weight(1f), color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(formatWalletAmount(com.nantty.android.data.WalletMoney(order.totalMinor, order.currency)), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
internal fun BuyerOrdersMessage(title: String, message: String, action: (() -> Unit)? = null, actionLabel: String = "Retry") {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 36.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(message, color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.bodyLarge)
        action?.let { TextButton(onClick = it) { Text(actionLabel) } }
    }
}

internal fun buyerOrderStatusLabel(status: String): String = when (status) {
    "pending" -> "Pending payment"
    "new" -> "Paid"
    "processing" -> "Processing"
    "ready" -> "Ready"
    "shipped" -> "Shipped"
    "delivered" -> "Delivered"
    "completed" -> "Completed"
    "cancelled" -> "Cancelled"
    "refunded" -> "Refunded"
    "returned" -> "Returned"
    "disputed" -> "Disputed"
    else -> "Status update"
}

internal fun formatBuyerOrderDate(value: String): String = runCatching {
    DateTimeFormatter.ofPattern("d MMM yyyy", Locale.getDefault())
        .withZone(ZoneId.systemDefault())
        .format(Instant.parse(value))
}.getOrDefault(value.take(10).ifBlank { "Date unavailable" })
