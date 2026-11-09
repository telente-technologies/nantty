package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.nantty.android.data.AdsBalanceCreditLot
import com.nantty.android.data.AdsBalanceSummary
import com.nantty.android.data.AdsBalanceTransaction
import com.nantty.android.data.AdsWorkspaceMoney
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Currency
import java.util.Locale

@Composable
internal fun AdsBalanceSummarySection(balance: AdsBalanceSummary) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            AdsBalanceAmountCard("Ad balance · withdrawable", balance.balance, Modifier.weight(1f))
            AdsBalanceAmountCard("Ad credit · ads only", balance.credit, Modifier.weight(1f))
        }
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("You can spend ${formatAdsMoney(balance.spendable)} on ads. Credit is used first.", style = MaterialTheme.typography.bodyMedium)
                if (balance.committed.amountMinor > 0) Text(
                    "${formatAdsMoney(balance.committed)} is reserved by ads that are running or in review.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (balance.pendingSettlement.amountMinor > 0) Text(
                    "${formatAdsMoney(balance.pendingSettlement)} from recent top-ups can be withdrawn 24 hours after it arrives.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (balance.cashbackEnabled) Text(
                    "You get ${balance.cashbackPercent}% of your ad spend back as ad credit.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text("Ad credit can only be spent on ads. It can't be withdrawn.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (balance.creditLots.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Your ad credit", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.semantics { heading() })
                balance.creditLots.forEach { AdsBalanceCreditLotRow(it) }
            }
        }
    }
}

@Composable
private fun AdsBalanceAmountCard(label: String, amount: AdsWorkspaceMoney, modifier: Modifier = Modifier) {
    Card(modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(formatAdsMoney(amount), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun AdsBalanceCreditLotRow(lot: AdsBalanceCreditLot) {
    val expiry = lot.expiresAt?.let(::formatAdsDate)?.let { "Expires $it" } ?: "No expiry shown"
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(lot.reason?.takeIf(String::isNotBlank) ?: lot.source.replace('_', ' '), style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(expiry, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text(formatAdsMoney(lot.remaining), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}

@Composable
internal fun AdsBalanceHistoryRow(transaction: AdsBalanceTransaction) {
    Row(
        Modifier.fillMaxWidth().semantics {
            contentDescription = "${adsBalanceTransactionLabel(transaction.kind)}, ${transaction.pot}, ${formatAdsMoney(transaction.amount)}, ${formatAdsDate(transaction.createdAt)}"
        },
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(adsBalanceTransactionLabel(transaction.kind), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
            Text(
                buildString {
                    append(if (transaction.pot == "credit") "Ad credit" else "Ad balance")
                    append(" · ")
                    append(formatAdsDate(transaction.createdAt))
                    transaction.description.takeIf(String::isNotBlank)?.let { append(" · $it") }
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Text(
            (if (transaction.amount.amountMinor > 0) "+" else "") + formatAdsMoney(transaction.amount),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            color = if (transaction.amount.amountMinor < 0) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.tertiary,
        )
    }
}

@Composable
internal fun AdsBalanceHistoryDivider() = HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

internal fun adsBalanceTransactionLabel(kind: String): String = when (kind) {
    "top_up" -> "Top-up"
    "boost_funding" -> "Ad funding"
    "earnings_funding" -> "Earnings funding"
    "spent" -> "Ad spend"
    "refund" -> "Refund"
    "withdrawal" -> "Withdrawn to wallet"
    "credit_issued" -> "Ad credit added"
    "cashback" -> "Cashback"
    "cashback_reversed" -> "Cashback reversed"
    "credit_spent" -> "Ad credit used"
    "credit_expired" -> "Expired"
    "credit_revoked" -> "Ad credit removed"
    "debt" -> "Ad spend adjustment"
    else -> kind.replace('_', ' ').replaceFirstChar { it.uppercase() }
}

internal fun parseAdsBalanceAmount(value: String, currencyCode: String): AdsWorkspaceMoney? = runCatching {
    val digits = Currency.getInstance(currencyCode).defaultFractionDigits.takeIf { it >= 0 } ?: 2
    val amount = java.math.BigDecimal(value.trim().replace(",", ""))
        .movePointRight(digits)
        .setScale(0, java.math.RoundingMode.UNNECESSARY)
        .longValueExact()
    amount.takeIf { it > 0 }?.let { AdsWorkspaceMoney(it, currencyCode) }
}.getOrNull()

private fun formatAdsDate(value: String): String = runCatching {
    DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.getDefault()).withZone(ZoneId.systemDefault()).format(Instant.parse(value))
}.getOrDefault(value)

