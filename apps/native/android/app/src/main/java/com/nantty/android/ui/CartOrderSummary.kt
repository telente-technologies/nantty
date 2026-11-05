package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.CartSellerSummary
import com.nantty.android.data.CartSnapshot
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.formatWalletAmount

@Composable
internal fun CartSellerShippingSummary(group: CartSellerSummary) {
    val shipping = group.shipping
    val shippingHint = when {
        shipping.status != "calculated" -> shipping.message
        shipping.freeThreshold == null && shipping.isFree -> "You qualify for free shipping to your location"
        shipping.freeThreshold != null && shipping.isFree -> "You qualify for free shipping on orders above ${formatWalletAmount(shipping.freeThreshold)}"
        shipping.amountToFreeShipping?.amountMinor?.let { it > 0L } == true -> "Add ${formatWalletAmount(shipping.amountToFreeShipping)} more for free shipping"
        shipping.freeThreshold != null -> "Free shipping on orders above ${formatWalletAmount(shipping.freeThreshold)}"
        else -> null
    }
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(group.storeName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            CartSummaryLine("Subtotal", group.subtotal)
            CartSummaryLine("Discounts", group.discounts)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Shipping", style = MaterialTheme.typography.bodyMedium)
                when {
                    shipping.status != "calculated" -> Text(
                        if (shipping.status == "notDeliverable") "Unavailable" else "—",
                        color = if (shipping.status == "notDeliverable") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall,
                    )
                    shipping.isFree -> Text("FREE", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
                    shipping.fee != null -> Text(formatWalletAmount(shipping.fee), style = MaterialTheme.typography.bodyMedium)
                }
            }
            if (shippingHint != null) {
                Text(
                    shippingHint,
                    color = if (shipping.status == "notDeliverable") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            if (shipping.status != "notDeliverable") CartSummaryLine("Seller total", group.total)
        }
    }
}

@Composable
internal fun CartOrderSummary(cart: CartSnapshot) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Order total", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            cart.itemsTotal?.let { CartSummaryLine("Items", it) }
            cart.discounts?.takeIf { it.amountMinor > 0L }?.let { CartSummaryLine("Discounts", it, negative = true) }
            cart.storeCredit?.takeIf { it.amountMinor > 0L }?.let { CartSummaryLine("Store credit", it, negative = true) }
            cart.shipping?.let { CartSummaryLine("Delivery", it) }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Total", fontWeight = FontWeight.Bold)
                Text(formatWalletAmount(WalletMoney(cart.totalAmountMinor, cart.currency)), fontWeight = FontWeight.Bold)
            }
            val excluded = cart.sellerGroups.count { it.shipping.status == "notDeliverable" }
            if (cart.addressId != null && excluded > 0) {
                Text(
                    "$excluded ${if (excluded == 1) "seller is" else "sellers are"} not included because they don't deliver to this address.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

@Composable
private fun CartSummaryLine(label: String, money: WalletMoney, negative: Boolean = false) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text((if (negative) "−" else "") + formatWalletAmount(money), style = MaterialTheme.typography.bodyMedium)
    }
}
