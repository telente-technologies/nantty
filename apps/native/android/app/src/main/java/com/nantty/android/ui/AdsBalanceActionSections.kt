package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.nantty.android.data.AdsBalanceSummary
import com.nantty.android.data.AdsBalanceWithdrawalQuote
import com.nantty.android.data.AdsWorkspaceMoney

@Composable
internal fun AdsBalanceTopUpSection(
    balance: AdsBalanceSummary,
    amountText: String,
    loading: Boolean,
    error: String?,
    reauthenticationRequired: Boolean,
    onReauthenticate: () -> Unit,
    onAmountTextChange: (String) -> Unit,
    onStartTopUp: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val amount = parseAdsBalanceAmount(amountText, balance.topUpMinimum.currency)
    val belowMinimum = amount != null && amount.amountMinor < balance.topUpMinimum.amountMinor
    val aboveMaximum = amount != null && amount.amountMinor > balance.topUpMaximum.amountMinor
    Card(modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Top up ad balance", style = MaterialTheme.typography.titleMedium)
            if (!balance.topUpAvailable) {
                Text(balance.topUpReason ?: "Top-ups aren't available right now.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    balance.suggestedTopUps.forEachIndexed { index, suggestion ->
                        FilterChip(
                            selected = amount == suggestion,
                            onClick = { onAmountTextChange(adsBalanceAmountInput(suggestion)) },
                            label = { Text(formatAdsMoney(suggestion)) },
                            modifier = Modifier.testTag("ads-balance-top-up-suggestion-$index"),
                        )
                    }
                }
                OutlinedTextField(
                    value = amountText,
                    onValueChange = onAmountTextChange,
                    label = { Text("Or enter an amount") },
                    supportingText = { Text("Between ${formatAdsMoney(balance.topUpMinimum)} and ${formatAdsMoney(balance.topUpMaximum)}") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("ads-balance-top-up-amount"),
                )
                Text("Pay securely by card or bank transfer in the hosted checkout.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.semantics { contentDescription = it }) }
                if (reauthenticationRequired) TextButton(onClick = onReauthenticate) { Text("Sign in again") }
                Button(
                    onClick = onStartTopUp,
                    enabled = amount != null && !belowMinimum && !aboveMaximum && !loading,
                    modifier = Modifier.fillMaxWidth().testTag("ads-balance-top-up-submit"),
                ) { Text(if (loading) "Starting checkout…" else amount?.let { "Top up ${formatAdsMoney(it)}" } ?: "Top up") }
            }
        }
    }
}

@Composable
internal fun AdsBalanceWithdrawalSection(
    balance: AdsBalanceSummary,
    amountText: String,
    quote: AdsBalanceWithdrawalQuote?,
    quoteLoading: Boolean,
    quoteError: String?,
    quoteRequiresAuthentication: Boolean,
    submitting: Boolean,
    error: String?,
    authenticationRequired: Boolean,
    status: String?,
    onReauthenticate: () -> Unit,
    onAmountTextChange: (String) -> Unit,
    onWithdraw: () -> Unit,
    onManagePayoutAccounts: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val amount = parseAdsBalanceAmount(amountText, balance.withdrawal.minimum.currency)
    Card(modifier, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Withdraw ad balance", style = MaterialTheme.typography.titleMedium)
            Text("${formatAdsMoney(balance.withdrawable)} can be withdrawn to your Nantty wallet.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (!balance.withdrawal.available) {
                Text(balance.withdrawal.reason ?: "Withdrawals aren't available right now.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (balance.withdrawal.reasonCode == "VERIFICATION_REQUIRED") {
                    TextButton(onClick = onManagePayoutAccounts, modifier = Modifier.fillMaxWidth()) {
                        Text("Manage payout accounts")
                    }
                }
            } else {
                OutlinedTextField(
                    value = amountText,
                    onValueChange = onAmountTextChange,
                    label = { Text("Amount to withdraw") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("ads-balance-withdraw-amount"),
                )
                if (quoteLoading && quote == null) Text("Getting the fee…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                quoteError?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
                if (quoteRequiresAuthentication || authenticationRequired) TextButton(onClick = onReauthenticate) { Text("Sign in again") }
                quote?.let {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.testTag("ads-balance-withdraw-quote")) {
                        Text("Payment provider fee: ${formatAdsMoney(it.fee)}", style = MaterialTheme.typography.bodyMedium)
                        Text("You get ${formatAdsMoney(it.net)} in your wallet", style = MaterialTheme.typography.titleSmall)
                    }
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                status?.let { Text(it, color = MaterialTheme.colorScheme.tertiary, style = MaterialTheme.typography.bodySmall) }
                Button(
                    onClick = onWithdraw,
                    enabled = quote != null && amount != null && quote.amount == amount && amount.amountMinor <= quote.withdrawable.amountMinor && !submitting,
                    modifier = Modifier.fillMaxWidth().testTag("ads-balance-withdraw-submit"),
                ) { Text(if (submitting) "Withdrawing…" else quote?.let { "Withdraw ${formatAdsMoney(it.amount)}" } ?: "Withdraw") }
            }
        }
    }
}

internal fun adsBalanceAmountInput(money: AdsWorkspaceMoney): String {
    val digits = runCatching { java.util.Currency.getInstance(money.currency).defaultFractionDigits }.getOrDefault(2).coerceAtLeast(0)
    return java.math.BigDecimal.valueOf(money.amountMinor, digits).stripTrailingZeros().toPlainString()
}
