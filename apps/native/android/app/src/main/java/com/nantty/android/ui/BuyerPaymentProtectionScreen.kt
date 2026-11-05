package com.nantty.android.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import com.nantty.android.data.DisputeRepository
import com.nantty.android.data.DisputeRepositoryResult
import com.nantty.android.data.OrderEscrowDetail
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.formatWalletAmount
import java.util.concurrent.Executor

/** Reads the actual escrow record; payment verification is never used to infer an escrow stage. */
@Composable
internal fun BuyerPaymentProtectionScreen(
    orderId: String,
    repository: DisputeRepository,
    executor: Executor,
    onBack: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    onViewOrder: () -> Unit,
    onContinueShopping: () -> Unit,
) {
    var result by remember(orderId) { mutableStateOf<DisputeRepositoryResult<OrderEscrowDetail>?>(null) }
    var retry by remember(orderId) { mutableIntStateOf(0) }
    var generation by remember(orderId) { mutableIntStateOf(0) }
    BackHandler(onBack = onBack)

    LaunchedEffect(orderId, retry, repository) {
        val request = ++generation
        result = null
        executor.execute {
            val loaded = repository.loadEscrowForOrder(orderId)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (generation == request) result = loaded
            }
        }
    }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 8.dp, end = 16.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back to payment confirmation" }) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Spacer(Modifier.width(8.dp))
            Text("Payment protection", Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }

        when (val current = result) {
            null -> Column(
                Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading payment protection status" })
                Text("Loading payment protection", Modifier.padding(top = 12.dp), color = MaterialTheme.colorScheme.secondary)
            }
            is DisputeRepositoryResult.Failure -> Column(
                Modifier.fillMaxSize().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    if (current.authenticationRequired) "Sign in to view payment protection" else "Payment protection is unavailable",
                    Modifier.semantics { heading() },
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(current.message, Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.secondary)
                if (current.authenticationRequired) {
                    Button(onClick = onAuthenticationRequired, Modifier.padding(top = 16.dp)) { Text("Sign in again") }
                } else {
                    Button(onClick = { retry += 1 }, Modifier.padding(top = 16.dp)) { Text("Retry") }
                }
            }
            is DisputeRepositoryResult.Success -> PaymentProtectionContent(
                escrow = current.value,
                onViewOrder = onViewOrder,
                onContinueShopping = onContinueShopping,
            )
        }
    }
}

@Composable
private fun PaymentProtectionContent(
    escrow: OrderEscrowDetail,
    onViewOrder: () -> Unit,
    onContinueShopping: () -> Unit,
) {
    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Order ${escrow.orderReference}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Text("Status: ${buyerEscrowStageLabel(escrow.stage)}", Modifier.semantics { contentDescription = "Payment protection status: ${buyerEscrowStageLabel(escrow.stage)}" })
                    Text("Amount held: ${formatWalletAmount(WalletMoney(escrow.heldAmount.amountMinor, escrow.heldAmount.currency))}")
                    escrow.paidAt?.let { Text("Payment recorded: ${formatBuyerOrderDate(it)}") }
                    val releaseAt = escrow.expectedReleaseAt ?: escrow.autoReleaseAt
                    releaseAt?.let { Text("Expected release: ${formatBuyerOrderDate(it)}") }
                    escrow.releasedAt?.let { Text("Released: ${formatBuyerOrderDate(it)}") }
                    escrow.refundedAt?.let { Text("Refund recorded: ${formatBuyerOrderDate(it)}") }
                }
            }
        }
        item {
            Text(
                "The status and timing shown here come from Nantty's order protection record.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        item { Button(onClick = onViewOrder, Modifier.fillMaxWidth()) { Text("View order details") } }
        item { OutlinedButton(onClick = onContinueShopping, Modifier.fillMaxWidth()) { Text("Continue shopping") } }
        item { Spacer(Modifier.size(8.dp)) }
    }
}

internal fun buyerEscrowStageLabel(stage: String): String = when (stage) {
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
    else -> "Status unavailable"
}
