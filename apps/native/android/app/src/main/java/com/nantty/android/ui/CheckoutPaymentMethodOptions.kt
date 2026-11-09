package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.CheckoutPaymentMethod
import com.nantty.android.data.CheckoutProviderWallet
import com.nantty.android.data.DeviceSavedCard
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.formatWalletAmount

@Composable
internal fun CheckoutPaymentMethodOptions(
    wallet: CheckoutProviderWallet?,
    savedCard: DeviceSavedCard?,
    total: WalletMoney?,
    paymentChannels: List<String> = emptyList(),
    selected: CheckoutPaymentMethod,
    saveCardOnDevice: Boolean,
    onSaveCardOnDeviceChange: (Boolean) -> Unit,
    onRemoveSavedCard: () -> Unit,
    onSelect: (CheckoutPaymentMethod) -> Unit,
) {
    val canPayFromWallet = wallet?.let { current ->
        current.status == "active" && total != null && current.currency == total.currency && current.spendableMinor >= total.amountMinor && total.amountMinor > 0
    } == true

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Payment method", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        if (canPayFromWallet && total != null) {
            Card(
                onClick = { onSelect(CheckoutPaymentMethod.PROVIDER_WALLET) },
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(12.dp).semantics { contentDescription = "Pay from wallet" },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(selected = selected == CheckoutPaymentMethod.PROVIDER_WALLET, onClick = null)
                    Column(Modifier.weight(1f).padding(start = 8.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text("Pay from wallet", fontWeight = FontWeight.Medium)
                        Text(
                            "${formatWalletAmount(WalletMoney(requireNotNull(wallet).spendableMinor, wallet.currency))} available. Payment remains protected until delivery.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
        if (savedCard != null) {
            Card(
                onClick = { onSelect(CheckoutPaymentMethod.SAVED_CARD) },
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
            ) {
                Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(
                        Modifier.fillMaxWidth().semantics { contentDescription = "Pay with saved ${savedCard.brand} card ending in ${savedCard.last4}" },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = selected == CheckoutPaymentMethod.SAVED_CARD, onClick = null)
                        Column(Modifier.weight(1f).padding(start = 8.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text("${savedCard.brand} •••• ${savedCard.last4}", fontWeight = FontWeight.Medium)
                            Text("Expires ${"%02d".format(savedCard.expiryMonth)}/${savedCard.expiryYear}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        TextButton(onClick = onRemoveSavedCard) { Text("Remove") }
                    }
                    if (selected == CheckoutPaymentMethod.SAVED_CARD) {
                        Text("Your device will ask you to confirm with biometrics before this card is charged.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        Card(
            onClick = { onSelect(CheckoutPaymentMethod.HOSTED) },
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
        ) {
            Row(
                Modifier.fillMaxWidth().padding(12.dp).semantics { contentDescription = "Pay in secure payment window" },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RadioButton(selected = selected == CheckoutPaymentMethod.HOSTED, onClick = null)
                Column(Modifier.weight(1f).padding(start = 8.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("Secure payment window", fontWeight = FontWeight.Medium)
                    Text(
                        checkoutPaymentChannelSummary(paymentChannels),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        if (selected == CheckoutPaymentMethod.HOSTED && savedCard == null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = saveCardOnDevice, onCheckedChange = onSaveCardOnDeviceChange)
                Column {
                    Text("Save card on this device", style = MaterialTheme.typography.bodyMedium)
                    Text("After payment, verify and store only a Nantty card token and masked details.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

internal fun checkoutPaymentChannelSummary(channels: List<String>): String = channels.mapNotNull { channel ->
    when (channel) {
        "card" -> "Card"
        "bank" -> "Bank"
        "bank_transfer" -> "Bank transfer"
        "ussd" -> "USSD"
        else -> null
    }
}.distinct().joinToString(", ").ifBlank { "Card, bank transfer or USSD" }
