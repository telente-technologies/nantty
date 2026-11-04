package com.nantty.android.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.Wallet
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nantty.android.data.AdsWorkspaceBalance
import com.nantty.android.data.AdsWorkspaceBoost
import com.nantty.android.data.AdsWorkspaceBoostPage
import com.nantty.android.data.AdsWorkspaceBoostStatus
import com.nantty.android.data.AdsWorkspaceFilter
import com.nantty.android.data.AdsWorkspaceRepository
import com.nantty.android.data.AdsWorkspaceResult
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale
import java.util.concurrent.Executor

/** Read-only ads overview. Deliberately has no campaign or balance mutation callbacks. */
@Composable
fun AdsWorkspaceScreen(
    repository: AdsWorkspaceRepository,
    executor: Executor,
    modifier: Modifier = Modifier,
    onReauthenticate: () -> Unit = {},
) {
    var filter by remember(repository) { mutableStateOf(AdsWorkspaceFilter.ALL) }
    var refreshVersion by remember(repository) { mutableIntStateOf(0) }
    var balanceRefreshVersion by remember(repository) { mutableIntStateOf(0) }
    var requestGeneration by remember(repository) { mutableIntStateOf(0) }
    var boostsResult by remember(repository) { mutableStateOf<AdsWorkspaceResult<AdsWorkspaceBoostPage>?>(null) }
    var balanceResult by remember(repository) { mutableStateOf<AdsWorkspaceResult<AdsWorkspaceBalance>?>(null) }
    var loadingBoosts by remember(repository) { mutableStateOf(true) }
    var loadingBalance by remember(repository) { mutableStateOf(true) }
    var loadingMore by remember(repository) { mutableStateOf(false) }
    var pageError by remember(repository) { mutableStateOf<String?>(null) }

    fun refresh() {
        refreshVersion += 1
        balanceRefreshVersion += 1
    }

    fun selectFilter(next: AdsWorkspaceFilter) {
        if (filter == next) return
        filter = next
        boostsResult = null
        loadingBoosts = true
        loadingMore = false
        pageError = null
    }

    LaunchedEffect(repository, filter, refreshVersion) {
        val currentFilter = filter
        val generation = requestGeneration + 1
        requestGeneration = generation
        loadingBoosts = true
        loadingMore = false
        pageError = null
        executor.execute {
            val result = repository.loadBoosts(currentFilter)
            Snapshot.withMutableSnapshot {
                if (generation == requestGeneration && currentFilter == filter) {
                    boostsResult = result
                    loadingBoosts = false
                }
            }
        }
    }

    LaunchedEffect(repository, balanceRefreshVersion) {
        val generation = balanceRefreshVersion
        loadingBalance = true
        executor.execute {
            val result = repository.loadBalance()
            Snapshot.withMutableSnapshot {
                if (generation == balanceRefreshVersion) {
                    balanceResult = result
                    loadingBalance = false
                }
            }
        }
    }

    fun loadNextPage() {
        val current = (boostsResult as? AdsWorkspaceResult.Success)?.value ?: return
        val cursor = current.nextCursor ?: return
        if (loadingMore || loadingBoosts) return
        val generation = requestGeneration
        val requestedFilter = filter
        loadingMore = true
        pageError = null
        executor.execute {
            val next = repository.loadBoosts(requestedFilter, cursor)
            Snapshot.withMutableSnapshot {
                if (generation != requestGeneration || requestedFilter != filter) return@withMutableSnapshot
                when (next) {
                    is AdsWorkspaceResult.Failure -> pageError = next.message
                    is AdsWorkspaceResult.Success -> {
                        val latest = (boostsResult as? AdsWorkspaceResult.Success)?.value ?: current
                        val merged = (latest.boosts + next.value.boosts).distinctBy(AdsWorkspaceBoost::id)
                        boostsResult = AdsWorkspaceResult.Success(AdsWorkspaceBoostPage(merged, next.value.nextCursor))
                    }
                }
                loadingMore = false
            }
        }
    }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 18.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Ads", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            IconButton(
                onClick = ::refresh,
                enabled = !loadingBoosts && !loadingBalance && !loadingMore,
                modifier = Modifier.semantics { contentDescription = "Refresh ads and balance" },
            ) { Icon(Icons.Default.Refresh, contentDescription = null) }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val wide = maxWidth >= 760.dp
            if (wide) {
                Row(
                    Modifier.fillMaxSize().widthIn(max = 1200.dp).align(Alignment.TopCenter).padding(20.dp),
                    horizontalArrangement = Arrangement.spacedBy(20.dp),
                ) {
                    AdsBalancePanel(
                        result = balanceResult,
                        loading = loadingBalance,
                        onRetry = ::refresh,
                        onReauthenticate = onReauthenticate,
                        modifier = Modifier.widthIn(min = 260.dp, max = 320.dp),
                    )
                    AdsBoostList(
                        result = boostsResult,
                        filter = filter,
                        loading = loadingBoosts,
                        loadingMore = loadingMore,
                        pageError = pageError,
                        onFilter = ::selectFilter,
                        onRetry = ::refresh,
                        onLoadMore = ::loadNextPage,
                        onReauthenticate = onReauthenticate,
                        modifier = Modifier.weight(1f),
                    )
                }
            } else {
                AdsBoostList(
                    result = boostsResult,
                    filter = filter,
                    loading = loadingBoosts,
                    loadingMore = loadingMore,
                    pageError = pageError,
                    onFilter = ::selectFilter,
                    onRetry = ::refresh,
                    onLoadMore = ::loadNextPage,
                    onReauthenticate = onReauthenticate,
                    balanceResult = balanceResult,
                    balanceLoading = loadingBalance,
                    onBalanceRetry = ::refresh,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
    }
}

@Composable
private fun AdsBoostList(
    result: AdsWorkspaceResult<AdsWorkspaceBoostPage>?,
    filter: AdsWorkspaceFilter,
    loading: Boolean,
    loadingMore: Boolean,
    pageError: String?,
    onFilter: (AdsWorkspaceFilter) -> Unit,
    onRetry: () -> Unit,
    onLoadMore: () -> Unit,
    onReauthenticate: () -> Unit,
    modifier: Modifier = Modifier,
    balanceResult: AdsWorkspaceResult<AdsWorkspaceBalance>? = null,
    balanceLoading: Boolean = false,
    onBalanceRetry: () -> Unit = {},
) {
    val page = (result as? AdsWorkspaceResult.Success)?.value
    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (balanceResult != null || balanceLoading) {
            item(key = "ads-balance") {
                AdsBalancePanel(balanceResult, balanceLoading, onBalanceRetry, onReauthenticate)
            }
        }
        item(key = "ads-filters") {
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                AdsWorkspaceFilter.entries.forEach { option ->
                    FilterChip(
                        selected = option == filter,
                        onClick = { onFilter(option) },
                        label = { Text(option.label) },
                    )
                }
            }
        }
        when {
            loading && page == null -> item(key = "ads-loading") { LoadingState("Loading ads") }
            result is AdsWorkspaceResult.Failure -> item(key = "ads-error") {
                ErrorState(
                    title = "Ads could not load",
                    message = result.message,
                    actionLabel = if (result.authenticationRequired) "Sign in again" else "Try again",
                    onAction = if (result.authenticationRequired) onReauthenticate else onRetry,
                )
            }
            page != null && page.boosts.isEmpty() -> item(key = "ads-empty") {
                EmptyState(
                    title = if (filter == AdsWorkspaceFilter.ALL) "No ads yet" else "No ${filter.label.lowercase()} ads",
                    message = if (filter == AdsWorkspaceFilter.ALL) "Your ad campaigns will appear here." else "There are no ads in this status.",
                )
            }
            else -> Unit
        }
        if (page != null) {
            items(page.boosts, key = AdsWorkspaceBoost::id) { boost -> AdsBoostCard(boost) }
            if (pageError != null) {
                item(key = "ads-next-error") {
                    ErrorState(
                        title = "More ads could not load",
                        message = pageError,
                        actionLabel = "Try again",
                        onAction = onLoadMore,
                    )
                }
            } else if (loadingMore) {
                item(key = "ads-next-loading") { LoadingState("Loading more ads") }
            } else if (page.nextCursor != null) {
                item(key = "ads-load-more") {
                    TextButton(onClick = onLoadMore, modifier = Modifier.fillMaxWidth()) { Text("Load more ads") }
                }
            }
        }
    }
}

@Composable
private fun AdsBalancePanel(
    result: AdsWorkspaceResult<AdsWorkspaceBalance>?,
    loading: Boolean,
    onRetry: () -> Unit,
    onReauthenticate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val balance = (result as? AdsWorkspaceResult.Success)?.value
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Icon(Icons.Outlined.Wallet, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Text("Ad credit & balance", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            }
            when {
                loading && balance == null -> LoadingState("Loading ad balance")
                result is AdsWorkspaceResult.Failure -> ErrorState(
                    title = "Balance could not load",
                    message = result.message,
                    actionLabel = if (result.authenticationRequired) "Sign in again" else "Try again",
                    onAction = if (result.authenticationRequired) onReauthenticate else onRetry,
                )
                balance != null -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    BalanceAmount("Available to spend", balance.spendable, emphasized = true)
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    BalanceAmount("Balance", balance.balance)
                    BalanceAmount("Credit", balance.credit)
                    BalanceAmount("Committed", balance.committed)
                    BalanceAmount("Withdrawable", balance.withdrawable)
                    BalanceAmount("Pending settlement", balance.pendingSettlement)
                }
            }
        }
    }
}

@Composable
private fun BalanceAmount(label: String, amount: com.nantty.android.data.AdsWorkspaceMoney, emphasized: Boolean = false) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = if (emphasized) MaterialTheme.typography.titleSmall else MaterialTheme.typography.bodyMedium)
        Text(
            formatAdsMoney(amount),
            style = if (emphasized) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
            fontWeight = if (emphasized) FontWeight.SemiBold else FontWeight.Normal,
        )
    }
}

@Composable
private fun AdsBoostCard(boost: AdsWorkspaceBoost) {
    val statusColor = when (boost.status) {
        AdsWorkspaceBoostStatus.ACTIVE -> MaterialTheme.colorScheme.primary
        AdsWorkspaceBoostStatus.IN_REVIEW, AdsWorkspaceBoostStatus.PENDING_PAYMENT -> MaterialTheme.colorScheme.tertiary
        AdsWorkspaceBoostStatus.REJECTED -> MaterialTheme.colorScheme.error
        AdsWorkspaceBoostStatus.COMPLETED -> MaterialTheme.colorScheme.secondary
        AdsWorkspaceBoostStatus.PAUSED, AdsWorkspaceBoostStatus.CANCELLED -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    val destination = when (boost.destinationType) {
        "post" -> "Boosted post"
        "profile" -> "Promoted profile"
        "store" -> "Promoted store"
        "product" -> "Promoted product"
        else -> boost.destinationType
    }
    val spent = formatAdsMoney(boost.spent)
    val budget = formatAdsMoney(boost.totalBudget)
    val progress = if (boost.totalBudget.amountMinor > 0) {
        (boost.spent.amountMinor.toDouble() / boost.totalBudget.amountMinor.toDouble()).coerceIn(0.0, 1.0).toFloat()
    } else 0f
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(
            Modifier.fillMaxWidth().padding(16.dp).semantics {
                contentDescription = "$destination, ${boost.status.label}. $spent spent of $budget. ${boost.keyResultValue} ${boost.keyResultLabel}."
            },
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Outlined.Campaign, contentDescription = null, tint = statusColor)
                Text(destination, Modifier.weight(1f), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Surface(color = statusColor.copy(alpha = 0.12f), shape = MaterialTheme.shapes.small) {
                    Text(boost.status.label, Modifier.padding(horizontal = 9.dp, vertical = 5.dp), color = statusColor, style = MaterialTheme.typography.labelMedium)
                }
            }
            androidx.compose.material3.LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier.fillMaxWidth().height(4.dp).semantics { contentDescription = "Ad spend progress" },
                color = statusColor,
                trackColor = MaterialTheme.colorScheme.surfaceVariant,
            )
            Text("$spent of $budget spent", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("${boost.keyResultValue} ${boost.keyResultLabel}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                val endText = boost.endsAt?.let { "Ends $it" }
                    ?: boost.durationDays.takeIf { it > 0 }?.let { "${it}d after approval" }
                if (endText != null) Text(endText, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            boost.rejectionReason?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun LoadingState(label: String) {
    Row(Modifier.fillMaxWidth().padding(20.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        CircularProgressIndicator(Modifier.size(22.dp).semantics { contentDescription = label }, strokeWidth = 2.dp)
        Spacer(Modifier.width(10.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun ErrorState(title: String, message: String, actionLabel: String, onAction: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onErrorContainer)
            Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onErrorContainer)
            TextButton(onClick = onAction) { Text(actionLabel) }
        }
    }
}

@Composable
private fun EmptyState(title: String, message: String) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 36.dp).semantics { heading() },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun formatAdsMoney(money: com.nantty.android.data.AdsWorkspaceMoney): String {
    val currency = runCatching { Currency.getInstance(money.currency) }.getOrNull()
        ?: return "${money.amountMinor} ${money.currency} minor units"
    val digits = currency.defaultFractionDigits.takeIf { it >= 0 } ?: return "${money.amountMinor} ${money.currency} minor units"
    val major = BigDecimal.valueOf(money.amountMinor, digits)
    return NumberFormat.getCurrencyInstance(Locale.getDefault()).apply { this.currency = currency }.format(major)
}
