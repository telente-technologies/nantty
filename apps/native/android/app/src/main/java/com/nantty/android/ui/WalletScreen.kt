package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.nantty.android.data.WalletRepository
import com.nantty.android.data.WalletEscrowHold
import com.nantty.android.data.WalletEscrowHoldsResult
import com.nantty.android.data.WalletResult
import com.nantty.android.data.WalletSummary
import com.nantty.android.data.WalletTransaction
import com.nantty.android.data.WalletTransactionPage
import com.nantty.android.data.WalletTransactionsResult
import com.nantty.android.data.formatWalletAmount
import java.util.concurrent.Executor
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
internal fun WalletScreen(
    repository: WalletRepository,
    executor: Executor,
    modifier: Modifier = Modifier,
) {
    var managingPayoutAccounts by remember(repository) { mutableStateOf(false) }
    if (managingPayoutAccounts) {
        PayoutAccountsScreen(
            repository = repository.payoutAccountsRepository,
            executor = executor,
            onBack = { managingPayoutAccounts = false },
            modifier = modifier,
        )
        return
    }
    var result by remember(repository) { mutableStateOf<WalletResult?>(null) }
    var transactionsResult by remember(repository) { mutableStateOf<WalletTransactionsResult?>(null) }
    var escrowHoldsResult by remember(repository) { mutableStateOf<WalletEscrowHoldsResult?>(null) }
    var loadingWallet by remember(repository) { mutableStateOf(false) }
    var loadingTransactions by remember(repository) { mutableStateOf(false) }
    var loadingEscrowHolds by remember(repository) { mutableStateOf(false) }
    var loadingMoreTransactions by remember(repository) { mutableStateOf(false) }
    var transactionPageError by remember(repository) { mutableStateOf(false) }

    fun refreshWallet() {
        loadingWallet = true
        executor.execute {
            val next = repository.load()
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                result = next
                loadingWallet = false
            }
        }
    }

    fun refreshTransactions() {
        loadingTransactions = true
        transactionPageError = false
        executor.execute {
            val next = repository.loadRecentTransactions()
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                transactionsResult = next
                loadingTransactions = false
            }
        }
    }

    fun refreshEscrowHolds() {
        loadingEscrowHolds = true
        executor.execute {
            val next = repository.loadEscrowHolds()
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                escrowHoldsResult = next
                loadingEscrowHolds = false
            }
        }
    }

    fun loadMoreTransactions() {
        val currentPage = (transactionsResult as? WalletTransactionsResult.Success)?.page ?: return
        val cursor = currentPage.nextCursor ?: return
        if (loadingMoreTransactions) return
        loadingMoreTransactions = true
        transactionPageError = false
        executor.execute {
            val next = repository.loadRecentTransactions(cursor)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                when (next) {
                    is WalletTransactionsResult.Failure -> transactionPageError = true
                    is WalletTransactionsResult.Success -> {
                        val latest = (transactionsResult as? WalletTransactionsResult.Success)?.page ?: currentPage
                        val merged = (latest.items + next.page.items).distinctBy(WalletTransaction::id)
                        transactionsResult = WalletTransactionsResult.Success(WalletTransactionPage(merged, next.page.nextCursor))
                    }
                }
                loadingMoreTransactions = false
            }
        }
    }

    fun refresh() {
        refreshWallet()
        refreshTransactions()
        refreshEscrowHolds()
    }

    LaunchedEffect(repository) { refresh() }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 18.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Wallet", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            IconButton(onClick = ::refresh, enabled = !loadingWallet && !loadingTransactions && !loadingEscrowHolds && !loadingMoreTransactions, modifier = Modifier.semantics { contentDescription = "Refresh wallet" }) {
                Icon(Icons.Default.Refresh, contentDescription = null)
            }
        }
        when (val current = result) {
            null -> {
                BoxMessage("Loading wallet…", showProgress = true, modifier = Modifier.weight(1f))
                if (transactionsResult == null) {
                    WalletTransactionsMessage("Loading transactions…", showProgress = true, modifier = Modifier.padding(horizontal = 18.dp).padding(bottom = 8.dp))
                }
            }
            is WalletResult.Failure -> if (loadingWallet) {
                BoxMessage("Retrying wallet…", showProgress = true, modifier = Modifier.weight(1f))
            } else {
                BoxMessage(current.message, action = ::refresh, actionLabel = "Try again", modifier = Modifier.weight(1f))
            }
            is WalletResult.Success -> Box(
                Modifier.weight(1f).fillMaxWidth(),
                contentAlignment = Alignment.TopCenter,
            ) {
                WalletContent(
                    wallet = current.wallet,
                    escrowHoldsResult = escrowHoldsResult,
                    loadingEscrowHolds = loadingEscrowHolds,
                    onRetryEscrowHolds = ::refreshEscrowHolds,
                    transactionsResult = transactionsResult,
                    loadingTransactions = loadingTransactions,
                    loadingMoreTransactions = loadingMoreTransactions,
                    transactionPageError = transactionPageError,
                    onRetryTransactions = ::refreshTransactions,
                    onLoadMoreTransactions = ::loadMoreTransactions,
                    onManagePayoutAccounts = { managingPayoutAccounts = true },
                    repository = repository,
                    executor = executor,
                    onRefreshWallet = ::refreshWallet,
                    onWithdrawalSuccess = { refreshWallet(); refreshTransactions() },
                )
            }
        }
    }

}

@Composable
private fun WalletContent(
    wallet: WalletSummary,
    escrowHoldsResult: WalletEscrowHoldsResult?,
    loadingEscrowHolds: Boolean,
    onRetryEscrowHolds: () -> Unit,
    transactionsResult: WalletTransactionsResult?,
    loadingTransactions: Boolean,
    loadingMoreTransactions: Boolean,
    transactionPageError: Boolean,
    onRetryTransactions: () -> Unit,
    onLoadMoreTransactions: () -> Unit,
    onManagePayoutAccounts: () -> Unit,
    repository: WalletRepository,
    executor: Executor,
    onRefreshWallet: () -> Unit,
    onWithdrawalSuccess: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier.widthIn(max = 760.dp).fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 18.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (!wallet.verification.withdrawalsUnlocked) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                    Text(
                        wallet.verification.message ?: "Complete verification before requesting withdrawals.",
                        Modifier.fillMaxWidth().padding(16.dp),
                        color = MaterialTheme.colorScheme.onSecondaryContainer,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        } else if (!wallet.verification.message.isNullOrBlank()) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                    Text(wallet.verification.message, Modifier.fillMaxWidth().padding(16.dp), color = MaterialTheme.colorScheme.onSecondaryContainer)
                }
            }
        }

        item {
            Text("Balances", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        }
        items(wallet.lines, key = { "${it.key}:${it.label}" }) { line ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                Column(Modifier.fillMaxWidth().padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(line.label, Modifier.weight(1f), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Text(formatWalletAmount(line.amount), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    }
                    if (line.description.isNotBlank()) {
                        Spacer(Modifier.height(6.dp))
                        Text(line.description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }

        item {
            WalletWithdrawalSection(
                repository = repository,
                executor = executor,
                wallet = wallet,
                onManagePayoutAccounts = onManagePayoutAccounts,
                onRefreshWallet = onRefreshWallet,
                onWithdrawalSuccess = onWithdrawalSuccess,
            )
        }

        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
                    Text("Payout accounts", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(4.dp))
                    Text("Manage the bank accounts used for withdrawals.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                    TextButton(onClick = onManagePayoutAccounts, modifier = Modifier.align(Alignment.End)) { Text("Manage accounts") }
                }
            }
        }

        item {
            Text("Held in escrow", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        }
        when (val holds = escrowHoldsResult) {
            null -> item { WalletTransactionsMessage("Loading escrow holds…", showProgress = true) }
            is WalletEscrowHoldsResult.Failure -> if (loadingEscrowHolds) {
                item { WalletTransactionsMessage("Retrying escrow holds…", showProgress = true) }
            } else {
                item { WalletTransactionsMessage(holds.message, action = onRetryEscrowHolds, actionLabel = "Try again") }
            }
            is WalletEscrowHoldsResult.Success -> if (loadingEscrowHolds) {
                item { WalletTransactionsMessage("Refreshing escrow holds…", showProgress = true) }
            } else if (holds.holds.isEmpty()) {
                item { WalletTransactionsMessage("No orders are currently held in escrow.") }
            } else {
                items(holds.holds, key = WalletEscrowHold::orderId) { hold -> WalletEscrowHoldRow(hold) }
            }
        }

        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
                Column(Modifier.fillMaxWidth().padding(16.dp)) {
                    Text("Coins", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(8.dp))
                    WalletAmountRow("Spendable", wallet.coins.spendable)
                    WalletAmountRow("Earned", wallet.coins.earned)
                    Spacer(Modifier.height(4.dp))
                    Text("Coins are for gifts and are not cash.", color = MaterialTheme.colorScheme.onTertiaryContainer, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        item {
            Text("Recent transactions", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        }
        when (val history = transactionsResult) {
            null -> item { WalletTransactionsMessage("Loading transactions…", showProgress = true) }
            is WalletTransactionsResult.Failure -> if (loadingTransactions) {
                item { WalletTransactionsMessage("Retrying transactions…", showProgress = true) }
            } else {
                item { WalletTransactionsMessage(history.message, action = onRetryTransactions, actionLabel = "Try again") }
            }
            is WalletTransactionsResult.Success -> if (loadingTransactions) {
                item { WalletTransactionsMessage("Refreshing transactions…", showProgress = true) }
            } else if (history.page.items.isEmpty()) {
                item { WalletTransactionsMessage("No transactions yet. Payments, refunds and payouts will appear here.") }
            } else {
                items(history.page.items, key = { it.id }) { transaction -> WalletTransactionRow(transaction) }
                item(key = "wallet-transactions-more") {
                    when {
                        loadingMoreTransactions -> CircularProgressIndicator(
                            Modifier.padding(16.dp).semantics { contentDescription = "Loading more wallet transactions" },
                        )
                        transactionPageError -> TextButton(onClick = onLoadMoreTransactions, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                            Text("Couldn't load more. Try again")
                        }
                        history.page.nextCursor != null -> TextButton(onClick = onLoadMoreTransactions, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                            Text("Load more transactions")
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(8.dp)) }
    }
}

@Composable
private fun WalletEscrowHoldRow(hold: WalletEscrowHold) {
    val stageLabel = when (hold.stage) {
        "paid_into_escrow" -> "Paid into escrow"
        "seller_preparing" -> "Seller preparing"
        "shipped" -> "On the way"
        "delivered" -> "Delivered"
        "buyer_confirmed" -> "Receipt confirmed"
        "disputed" -> "In dispute"
        "under_review" -> "Under review"
        else -> "Escrow hold"
    }
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(hold.productName, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                Text(
                    listOfNotNull(hold.orderReference, stageLabel, hold.expectedReleaseAt?.let(::formatTransactionDate)?.let { "Expected release $it" }).joinToString(" · "),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Spacer(Modifier.width(12.dp))
            Text(formatWalletAmount(hold.amount), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun WalletTransactionRow(transaction: WalletTransaction) {
    val sign = when (transaction.kind.lowercase()) {
        "credit" -> "+"
        "debit" -> "−"
        else -> ""
    }
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(transaction.description.ifBlank { "Wallet transaction" }, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                val statusLabel = when (transaction.status) {
                    "completed" -> "Completed"
                    "pending" -> "Pending"
                    "failed" -> "Failed"
                    else -> "Unknown"
                }
                Text(
                    listOfNotNull(formatTransactionDate(transaction.createdAt), statusLabel).joinToString(" · "),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Spacer(Modifier.width(12.dp))
            Text("$sign${formatWalletAmount(transaction.amount)}", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        }
    }
}

private fun formatTransactionDate(value: String): String? = runCatching {
    DateTimeFormatter.ofPattern("d MMM yyyy", Locale("en", "NG"))
        .withZone(ZoneId.systemDefault())
        .format(Instant.parse(value))
}.getOrNull()

@Composable
private fun WalletTransactionsMessage(
    message: String,
    showProgress: Boolean = false,
    action: (() -> Unit)? = null,
    actionLabel: String = "",
    modifier: Modifier = Modifier,
) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            if (showProgress) CircularProgressIndicator()
            Text(message, Modifier.padding(top = if (showProgress) 12.dp else 0.dp), style = MaterialTheme.typography.bodyMedium)
            action?.let { TextButton(onClick = it) { Text(actionLabel) } }
        }
    }
}

@Composable
private fun WalletAmountRow(label: String, amount: Long) {
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f), color = MaterialTheme.colorScheme.onTertiaryContainer)
        Text(formatWalletAmount(com.nantty.android.data.WalletMoney(amount, "COIN")), fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun BoxMessage(message: String, showProgress: Boolean = false, action: (() -> Unit)? = null, actionLabel: String = "", modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxSize().padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        if (showProgress) CircularProgressIndicator()
        Text(message, Modifier.padding(top = if (showProgress) 16.dp else 0.dp), style = MaterialTheme.typography.bodyLarge)
        action?.let { TextButton(onClick = it) { Text(actionLabel) } }
    }
}
