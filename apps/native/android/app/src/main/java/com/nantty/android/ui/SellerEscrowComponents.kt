package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.OrderEscrowDetail
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.formatWalletAmount
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
internal fun SellerEscrowSummary(escrow: OrderEscrowDetail, modifier: Modifier = Modifier) {
    val stageLabel = when (escrow.stage) {
        "awaiting_payment" -> "Awaiting payment"
        "paid_into_escrow" -> "Paid into escrow"
        "seller_preparing" -> "Seller preparing"
        "shipped" -> "On the way"
        "delivered" -> "Delivered"
        "buyer_confirmed" -> "Receipt confirmed"
        "released_to_seller" -> "Released to seller"
        "disputed" -> "In dispute"
        "under_review" -> "Under review"
        "refunded" -> "Refunded"
        else -> "Escrow update"
    }
    val releaseCopy = when {
        escrow.releasedAt != null -> "Released ${formatEscrowDate(escrow.releasedAt)}"
        escrow.stage == "disputed" -> "Release paused while the dispute is reviewed"
        escrow.stage == "under_review" -> "Under review by Nantty staff. Payout remains on hold."
        escrow.stage == "refunded" -> "Order refunded"
        escrow.expectedReleaseAt != null -> "Expected release: ${formatEscrowDate(escrow.expectedReleaseAt)}"
        else -> "Release date appears once the order ships"
    }
    val amountLabel = "Your payout ${formatWalletAmount(WalletMoney(escrow.sellerPayoutAmount.amountMinor, escrow.sellerPayoutAmount.currency))}"

    Card(
        modifier = modifier.semantics { contentDescription = "Escrow summary. $stageLabel. $amountLabel. $releaseCopy" },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Order ${escrow.orderReference}", Modifier.weight(1f), style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Surface(color = escrowStageContainer(escrow.stage), shape = MaterialTheme.shapes.small) {
                    Text(stageLabel, Modifier.padding(horizontal = 9.dp, vertical = 5.dp), style = MaterialTheme.typography.labelMedium, color = escrowStageText(escrow.stage))
                }
            }
            Text("Your payout", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(formatWalletAmount(WalletMoney(escrow.sellerPayoutAmount.amountMinor, escrow.sellerPayoutAmount.currency)), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
            Text(
                "Buyer paid ${formatWalletAmount(WalletMoney(escrow.heldAmount.amountMinor, escrow.heldAmount.currency))} · Nantty fee ${formatWalletAmount(WalletMoney(escrow.platformFee.amountMinor, escrow.platformFee.currency))}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(releaseCopy, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, color = if (escrow.stage == "disputed" || escrow.stage == "under_review") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
internal fun SellerEscrowTimeline(escrow: OrderEscrowDetail, modifier: Modifier = Modifier) {
    val completed = when {
        escrow.releasedAt != null -> 5
        escrow.buyerConfirmedAt != null -> 4
        escrow.deliveredAt != null -> 3
        escrow.shipment != null -> 2
        escrow.paidAt != null -> 0
        else -> -1
    }
    val paused = escrow.stage in setOf("disputed", "under_review", "refunded")
    val steps = listOf(
        SellerEscrowStep("Paid into escrow", escrow.paidAt?.let { "Funds held safely by Nantty · ${formatEscrowDateTime(it)}" } ?: "Waiting for payment", escrow.paidAt != null),
        SellerEscrowStep("Seller preparing", escrow.preparingSince?.let { "Preparing since ${formatEscrowDateTime(it)}" } ?: "Pack the order and add the courier tracking number", completed >= 1),
        SellerEscrowStep("Shipped", escrow.shipment?.let { "${it.courierName} · ${it.trackingNumber} · ${formatEscrowDate(it.shippedAt)}" } ?: "Courier and tracking number will appear here", completed >= 2),
        SellerEscrowStep("Delivered", escrow.deliveredAt?.let(::formatEscrowDateTime) ?: escrow.shipment?.estimatedDeliveryAt?.let { "Expected by ${formatEscrowDate(it)}" } ?: "Arrives after shipping", completed >= 3),
        SellerEscrowStep(if (escrow.buyerConfirmedAt != null) "Buyer confirmed" else "Buyer confirms or auto-release", escrow.buyerConfirmedAt?.let { "Confirmed ${formatEscrowDateTime(it)}" } ?: escrow.autoReleaseAt?.let { "Auto-release ${formatEscrowDate(it)} unless a problem is reported" } ?: "Buyer has 3 days after delivery to confirm or report a problem", completed >= 4),
        SellerEscrowStep("Released to seller", escrow.releasedAt?.let { "${formatWalletAmount(WalletMoney(escrow.sellerPayoutAmount.amountMinor, escrow.sellerPayoutAmount.currency))} paid · ${formatEscrowDate(it)}" } ?: "Payout follows buyer confirmation or auto-release", completed >= 5),
    )
    Column(modifier, verticalArrangement = Arrangement.spacedBy(0.dp)) {
        steps.forEachIndexed { index, step ->
            val state = when {
                step.done -> "Complete"
                index == completed + 1 && !paused -> "In progress"
                else -> "Upcoming"
            }
            Row(Modifier.fillMaxWidth().semantics { contentDescription = "${step.title}. ${step.detail}. $state" }.padding(bottom = 14.dp), verticalAlignment = Alignment.Top) {
                Surface(color = if (step.done) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.extraLarge) {
                    Spacer(Modifier.width(12.dp).height(12.dp))
                }
                Column(Modifier.padding(start = 12.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(step.title, style = MaterialTheme.typography.bodyMedium, fontWeight = if (state == "Upcoming") FontWeight.Normal else FontWeight.Medium, color = if (state == "Upcoming") MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface)
                    Text(step.detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        if (paused) {
            val (title, message) = when (escrow.stage) {
                "under_review" -> "Under review" to "Nantty staff will review the order. Funds remain held until the case is resolved."
                "refunded" -> "Refunded to buyer" to "The escrow flow ended with a refund."
                else -> "Dispute open — release paused" to "Funds remain held until the dispute is resolved."
            }
            Text(title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.error)
            Text(message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

private data class SellerEscrowStep(val title: String, val detail: String, val done: Boolean)

@Composable
private fun escrowStageContainer(stage: String) = when (stage) {
    "disputed" -> MaterialTheme.colorScheme.errorContainer
    "under_review" -> MaterialTheme.colorScheme.tertiaryContainer
    "released_to_seller", "buyer_confirmed", "delivered" -> MaterialTheme.colorScheme.secondaryContainer
    else -> MaterialTheme.colorScheme.primaryContainer
}

@Composable
private fun escrowStageText(stage: String) = when (stage) {
    "disputed" -> MaterialTheme.colorScheme.onErrorContainer
    "under_review" -> MaterialTheme.colorScheme.onTertiaryContainer
    "released_to_seller", "buyer_confirmed", "delivered" -> MaterialTheme.colorScheme.onSecondaryContainer
    else -> MaterialTheme.colorScheme.onPrimaryContainer
}

private fun formatEscrowDate(value: String): String = formatEscrow(value, "d MMM")
private fun formatEscrowDateTime(value: String): String = formatEscrow(value, "d MMM, HH:mm")
private fun formatEscrow(value: String, pattern: String): String = runCatching {
    Instant.parse(value).atZone(ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern(pattern, Locale.getDefault()))
}.getOrDefault(value)
