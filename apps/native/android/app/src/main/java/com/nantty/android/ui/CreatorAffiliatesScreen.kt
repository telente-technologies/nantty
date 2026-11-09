package com.nantty.android.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.AffiliateEarning
import com.nantty.android.data.AffiliateMoney
import com.nantty.android.data.AffiliatePromotion
import com.nantty.android.data.AffiliateCatalogPage
import com.nantty.android.data.CreatorAffiliatesRepository
import com.nantty.android.data.CreatorAffiliatesResult
import com.nantty.android.data.PromotableAffiliateProduct
import com.nantty.android.share.affiliateProductShareUrl
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.delay

private enum class AffiliateSection(val label: String) { CATALOG("Can promote"), PROMOTING("Promoting"), EARNINGS("Earnings") }
private enum class AffiliateEarningFilter(val value: String, val label: String) {
    PENDING("pending", "Pending"), EARNED("earned", "Earned"), REVERSED("reversed", "Reversed"),
}

@Composable
internal fun CreatorAffiliatesScreen(
    repository: CreatorAffiliatesRepository,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var section by remember { mutableStateOf(AffiliateSection.CATALOG) }
    var search by remember { mutableStateOf("") }
    var catalog by remember(repository) { mutableStateOf<AffiliateCatalogPage?>(null) }
    var catalogCursor by remember { mutableStateOf<String?>(null) }
    var promotions by remember(repository) { mutableStateOf<List<AffiliatePromotion>?>(null) }
    var earningFilter by remember { mutableStateOf(AffiliateEarningFilter.PENDING) }
    var earnings by remember(repository, earningFilter) { mutableStateOf<com.nantty.android.data.AffiliateEarningsPage?>(null) }
    var loading by remember(repository, section, search, earningFilter) { mutableStateOf(false) }
    var workingProduct by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    BackHandler(enabled = true, onBack = onBack)

    LaunchedEffect(repository, section, search, earningFilter, reload) {
        if (section == AffiliateSection.CATALOG && search.isNotBlank()) delay(250)
        loading = true
        error = null
        when (section) {
            AffiliateSection.CATALOG -> {
                catalogCursor = null
                when (val result = withContext(Dispatchers.IO) { repository.listCatalog(search, null) }) {
                    is CreatorAffiliatesResult.Success -> catalog = result.value
                    is CreatorAffiliatesResult.Failure -> {
                        error = result.message
                        if (result.authenticationRequired) onAuthenticationRequired()
                    }
                }
            }
            AffiliateSection.PROMOTING -> when (val result = withContext(Dispatchers.IO) { repository.listPromotions() }) {
                is CreatorAffiliatesResult.Success -> promotions = result.value
                is CreatorAffiliatesResult.Failure -> {
                    error = result.message
                    if (result.authenticationRequired) onAuthenticationRequired()
                }
            }
            AffiliateSection.EARNINGS -> when (val result = withContext(Dispatchers.IO) { repository.listEarnings(earningFilter.value, null) }) {
                is CreatorAffiliatesResult.Success -> earnings = result.value
                is CreatorAffiliatesResult.Failure -> {
                    error = result.message
                    if (result.authenticationRequired) onAuthenticationRequired()
                }
            }
        }
        loading = false
    }

    Column(modifier.fillMaxSize().widthIn(max = 860.dp).padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Affiliate", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            TextButton(onClick = onBack) { Text("Creator Studio") }
            TextButton(onClick = { reload++ }, enabled = !loading) { Text("Refresh") }
        }
        Row(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AffiliateSection.entries.forEach { item ->
                FilterChip(selected = section == item, onClick = { section = item; notice = null }, label = { Text(item.label) })
            }
        }
        notice?.let { Text(it, Modifier.fillMaxWidth().semantics { liveRegion = androidx.compose.ui.semantics.LiveRegionMode.Polite }.padding(vertical = 6.dp), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall) }
        error?.let { Text(it, Modifier.fillMaxWidth().padding(vertical = 8.dp), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
        if (loading) {
            Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                CircularProgressIndicator()
                Text("Loading affiliate data", Modifier.padding(top = 8.dp), style = MaterialTheme.typography.bodySmall)
            }
        } else when (section) {
            AffiliateSection.CATALOG -> AffiliateCatalogContent(
                products = catalog?.data.orEmpty(), search = search, onSearch = { search = it.take(80) },
                nextCursor = catalog?.nextCursor, workingProduct = workingProduct,
                onCopy = { product ->
                    if (workingProduct != null) return@AffiliateCatalogContent
                    workingProduct = product.productId
                    error = null
                    notice = null
                    scope.launch {
                        val existing = product.link
                        val outcome = if (existing != null) CreatorAffiliatesResult.Success(existing)
                        else withContext(Dispatchers.IO) { repository.createLink(product.productId) }
                        when (outcome) {
                            is CreatorAffiliatesResult.Success -> {
                                copyAffiliateLink(context, product.productId, product.name, outcome.value.id)
                                notice = "Your product link was copied."
                                reload++
                            }
                            is CreatorAffiliatesResult.Failure -> {
                                error = outcome.message
                                if (outcome.authenticationRequired) onAuthenticationRequired()
                            }
                        }
                        workingProduct = null
                    }
                },
                onRequest = { product ->
                    if (workingProduct != null) return@AffiliateCatalogContent
                    workingProduct = product.productId
                    error = null
                    notice = null
                    scope.launch {
                        when (val result = withContext(Dispatchers.IO) { repository.requestToPromote(product.productId) }) {
                            is CreatorAffiliatesResult.Success -> { notice = "Approval request sent to ${product.store.name}."; reload++ }
                            is CreatorAffiliatesResult.Failure -> {
                                error = result.message
                                if (result.authenticationRequired) onAuthenticationRequired()
                            }
                        }
                        workingProduct = null
                    }
                },
                onLoadMore = {
                    val cursor = catalog?.nextCursor ?: return@AffiliateCatalogContent
                    if (loading) return@AffiliateCatalogContent
                    scope.launch {
                        loading = true
                        when (val result = withContext(Dispatchers.IO) { repository.listCatalog(search, cursor) }) {
                            is CreatorAffiliatesResult.Success -> catalog = AffiliateCatalogPage(catalog?.data.orEmpty() + result.value.data, result.value.nextCursor)
                            is CreatorAffiliatesResult.Failure -> {
                                error = result.message
                                if (result.authenticationRequired) onAuthenticationRequired()
                            }
                        }
                        loading = false
                    }
                },
            )
            AffiliateSection.PROMOTING -> AffiliatePromotionsContent(
                rows = promotions.orEmpty(), onCopy = { row ->
                    val link = row.link ?: return@AffiliatePromotionsContent
                    copyAffiliateLink(context, row.productId, row.name, link.id)
                    notice = "Your product link was copied."
                },
            )
            AffiliateSection.EARNINGS -> AffiliateEarningsContent(
                value = earnings, selected = earningFilter, onSelect = { earningFilter = it },
                onLoadMore = {
                    val cursor = earnings?.nextCursor ?: return@AffiliateEarningsContent
                    scope.launch {
                        loading = true
                        when (val result = withContext(Dispatchers.IO) { repository.listEarnings(earningFilter.value, cursor) }) {
                            is CreatorAffiliatesResult.Success -> {
                                val previous = earnings
                                earnings = result.value.copy(data = previous?.data.orEmpty() + result.value.data)
                            }
                            is CreatorAffiliatesResult.Failure -> {
                                error = result.message
                                if (result.authenticationRequired) onAuthenticationRequired()
                            }
                        }
                        loading = false
                    }
                },
            )
        }
    }
}

@Composable
private fun AffiliateCatalogContent(
    products: List<PromotableAffiliateProduct>,
    search: String,
    onSearch: (String) -> Unit,
    nextCursor: String?,
    workingProduct: String?,
    onCopy: (PromotableAffiliateProduct) -> Unit,
    onRequest: (PromotableAffiliateProduct) -> Unit,
    onLoadMore: () -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(search, onSearch, Modifier.fillMaxWidth().padding(top = 8.dp), label = { Text("Search products") }, singleLine = true)
        if (products.isEmpty()) AffiliateEmptyState("No products match", "Check back when more sellers open their products to affiliates.")
        else LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.weight(1f).padding(top = 8.dp)) {
            items(products, key = PromotableAffiliateProduct::productId) { product ->
                AffiliateProductCard(product, working = workingProduct == product.productId, onCopy = { onCopy(product) }, onRequest = { onRequest(product) })
            }
        }
        if (nextCursor != null) Button(onClick = onLoadMore, modifier = Modifier.fillMaxWidth()) { Text("Show more") }
    }
}

@Composable
private fun AffiliateProductCard(product: PromotableAffiliateProduct, working: Boolean, onCopy: () -> Unit, onRequest: () -> Unit) {
    AffiliateBaseCard(imageUrl = product.imageUrl, name = product.name, storeName = product.store.name, status = affiliateAccessLabel(product.access)) {
        Text("${product.store.name} · ${formatAffiliateMoney(product.price)} · ${affiliateStockLabel(product.stock)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("${product.commissionPercent}% commission · about ${formatAffiliateMoney(product.estimatedCommission)} per sale", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("${product.programme.attributionWindowDays}-day attribution · ${if (product.programme.approval == "automatic") "auto-approval" else "seller approval"} · paid when the order completes", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        when (product.access) {
            "approved", "open" -> Button(onClick = onCopy, enabled = !working, modifier = Modifier.fillMaxWidth()) { Text(if (working) "Preparing link…" else if (product.link != null) "Copy link" else "Create and copy link") }
            "approval_required" -> Button(onClick = onRequest, enabled = !working, modifier = Modifier.fillMaxWidth()) { Text(if (working) "Requesting…" else "Request to promote") }
            else -> Text(affiliateAccessDescription(product.access), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun AffiliatePromotionsContent(rows: List<AffiliatePromotion>, onCopy: (AffiliatePromotion) -> Unit) {
    if (rows.isEmpty()) return AffiliateEmptyState("Nothing promoted yet", "Copy a link from Can promote, or tag an approved product in a post, clip or live.")
    val topPerformers = rows.filter { it.earned.amountMinor > 0 }.take(3)
    Column(Modifier.fillMaxSize()) {
        if (topPerformers.isNotEmpty()) {
            Text(
                "Top performers: ${topPerformers.joinToString { it.name }}",
                Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 4.dp),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items(rows, key = AffiliatePromotion::productId) { row ->
                AffiliateBaseCard(imageUrl = row.imageUrl, name = row.name, storeName = row.store.name, status = affiliateAccessLabel(row.access)) {
                    Text("${row.commissionPercent}% commission now", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${row.clicks} clicks · ${row.completedOrders + row.pendingOrders} sales · ${row.conversionPercent?.let { "${it.toInt()}% conversion" } ?: "No clicks yet"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Earned ${formatAffiliateMoney(row.earned)} · pending ${formatAffiliateMoney(row.pendingEarnings)} · ${row.reversedOrders} reversed", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    row.link?.let { Button(onClick = { onCopy(row) }, modifier = Modifier.fillMaxWidth()) { Text("Copy link") } }
                }
            }
        }
    }
}

@Composable
private fun AffiliateEarningsContent(
    value: com.nantty.android.data.AffiliateEarningsPage?,
    selected: AffiliateEarningFilter,
    onSelect: (AffiliateEarningFilter) -> Unit,
    onLoadMore: () -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        Text("Commission is paid only when the order completes. Refunds, cancellations and unresolved disputes do not earn commission.", Modifier.padding(vertical = 8.dp), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            AffiliateEarningFilter.entries.forEach { tab -> FilterChip(selected == tab, { onSelect(tab) }, label = { Text(tab.label) }) }
        }
        value?.summary?.let { summary ->
            Card(Modifier.fillMaxWidth().padding(top = 8.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Pending ${formatAffiliateMoneyList(summary.pending)}", style = MaterialTheme.typography.bodySmall)
                    Text("Earned ${formatAffiliateMoneyList(summary.earned)} · paid ${formatAffiliateMoneyList(summary.paid)}", style = MaterialTheme.typography.bodySmall)
                    Text("Reversed ${formatAffiliateMoneyList(summary.reversed)}", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        if (value?.data.isNullOrEmpty()) AffiliateEmptyState("No ${selected.label.lowercase()} commissions", "Sales you drive will appear here.")
        else LazyColumn(Modifier.weight(1f).padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(value?.data.orEmpty(), key = AffiliateEarning::id) { earning -> AffiliateEarningCard(earning) }
        }
        if (value?.nextCursor != null) Button(onClick = onLoadMore, modifier = Modifier.fillMaxWidth()) { Text("Show more") }
    }
}

@Composable
private fun AffiliateEarningCard(earning: AffiliateEarning) {
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Affiliate commission from ${earning.storeName.ifBlank { "the store" }}, ${earning.orderNumber.ifBlank { "order" }} (${earning.productName.ifBlank { "product" }})", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text("${earning.commissionPercent}% of ${formatAffiliateMoney(earning.sale)} · ${affiliatePayoutLabel(earning.payoutStatus, earning.reason)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(if (earning.status == "reversed") "-${formatAffiliateMoney(earning.reversed)}" else formatAffiliateMoney(earning.commission), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun AffiliateBaseCard(imageUrl: String?, name: String, storeName: String, status: String, content: @Composable ColumnScope.() -> Unit) {
    Card(Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
                AsyncImage(model = imageUrl, contentDescription = null, modifier = Modifier.size(64.dp).padding(top = 2.dp), contentScale = androidx.compose.ui.layout.ContentScale.Crop)
                Column(Modifier.weight(1f)) {
                    Text(name.ifBlank { "Product no longer listed" }, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(storeName, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(status, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
            }
            content()
        }
    }
}

@Composable
private fun AffiliateEmptyState(title: String, body: String) {
    Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Text(body, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun copyAffiliateLink(context: Context, productId: String, name: String, linkId: String) {
    val url = affiliateProductShareUrl(productId, name, linkId)
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText("Nantty product link", url))
}

private fun affiliateStockLabel(stock: Long?): String = when {
    stock == null -> "Stock not tracked"
    stock > 0 -> "$stock in stock"
    else -> "Out of stock"
}

private fun affiliateAccessLabel(access: String): String = when (access) {
    "approved" -> "Approved"
    "paused" -> "Paused"
    "requested" -> "Requested"
    "open" -> "Open to you"
    "approval_required" -> "Needs approval"
    else -> "Closed"
}

private fun affiliateAccessDescription(access: String): String = when (access) {
    "requested" -> "The seller is reviewing your request."
    "paused" -> "This affiliate programme is paused."
    else -> "This product is not currently available for promotion."
}

private fun affiliatePayoutLabel(status: String, reason: String): String = when (status) {
    "awaiting_completion" -> "Paid when the order completes"
    "waiting_for_seller_funds" -> "Earned, waiting for seller funds"
    "transferring" -> "Transfer in progress"
    "paid" -> "Paid to your wallet"
    "reversed", "not_paid" -> reason.ifBlank { "Not paid" }
    else -> "Status unavailable"
}

private fun formatAffiliateMoney(value: AffiliateMoney): String {
    val digits = runCatching { Currency.getInstance(value.currency).defaultFractionDigits }.getOrDefault(2).coerceAtLeast(0)
    val formatter = NumberFormat.getCurrencyInstance(Locale.getDefault()).apply {
        currency = runCatching { Currency.getInstance(value.currency) }.getOrDefault(Currency.getInstance("USD"))
        minimumFractionDigits = digits
        maximumFractionDigits = digits
    }
    return runCatching { formatter.format(value.amountMinor / Math.pow(10.0, digits.toDouble())) }.getOrDefault("${value.currency} ${value.amountMinor}")
}

private fun formatAffiliateMoneyList(values: List<AffiliateMoney>): String =
    if (values.isEmpty()) "0" else values.joinToString(" + ", transform = ::formatAffiliateMoney)
