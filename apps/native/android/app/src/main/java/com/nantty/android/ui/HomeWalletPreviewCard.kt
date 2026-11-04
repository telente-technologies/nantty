package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.WalletRepository
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.WalletResult
import com.nantty.android.data.WalletSummary
import com.nantty.android.data.formatWalletAmount
import java.util.concurrent.Executor

/** Home-feed wallet preview. It is intentionally read-only; the full wallet owns financial actions. */
@Composable
internal fun HomeWalletPreviewCard(
    signedIn: Boolean,
    accountKey: String,
    repository: WalletRepository,
    executor: Executor,
    onPressWallet: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (!signedIn) return

    var result by remember(repository, accountKey) { mutableStateOf<WalletResult?>(null) }
    var loading by remember(repository, accountKey) { mutableStateOf(false) }

    fun load() {
        loading = true
        executor.execute {
            val next = repository.load()
            Snapshot.withMutableSnapshot {
                result = next
                loading = false
            }
        }
    }

    LaunchedEffect(repository, accountKey) { load() }

    Card(
        modifier = modifier.fillMaxWidth().testTag("home-wallet-preview"),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Wallet",
                    Modifier.weight(1f).semantics { heading() },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                TextButton(onClick = onPressWallet) {
                    Text("View wallet", maxLines = 1)
                }
            }

            when {
                result == null || loading && result !is WalletResult.Success -> LoadingState()
                result is WalletResult.Failure -> ErrorState(loading = loading, onRetry = ::load)
                result is WalletResult.Success -> WalletAmounts((result as WalletResult.Success).wallet)
            }
        }
    }
}

@Composable
private fun LoadingState() {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 48.dp).semantics {
            contentDescription = "Loading wallet summary"
            progressBarRangeInfo = androidx.compose.ui.semantics.ProgressBarRangeInfo.Indeterminate
        },
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CircularProgressIndicator()
        Text("Loading wallet…", style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun ErrorState(loading: Boolean, onRetry: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 48.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "Wallet summary could not be loaded.",
            Modifier.weight(1f),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        TextButton(onClick = onRetry, enabled = !loading) {
            Text(if (loading) "Retrying…" else "Retry", maxLines = 1)
        }
    }
}

@Composable
private fun WalletAmounts(wallet: WalletSummary) {
    val available = formatWalletAmount(wallet.available)
    val escrow = formatWalletAmount(wallet.pending)
    val coins = formatWalletAmount(WalletMoney(wallet.coins.spendable, "COIN"))

    BoxWithConstraints(Modifier.fillMaxWidth()) {
        if (maxWidth < 480.dp) {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                WalletAmount("Available", available, Modifier.fillMaxWidth())
                WalletAmount("In escrow", escrow, Modifier.fillMaxWidth())
                WalletAmount("Coins", coins, Modifier.fillMaxWidth())
            }
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                WalletAmount("Available", available, Modifier.weight(1f))
                WalletAmount("In escrow", escrow, Modifier.weight(1f))
                WalletAmount("Coins", coins, Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun WalletAmount(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
        )
    }
}
