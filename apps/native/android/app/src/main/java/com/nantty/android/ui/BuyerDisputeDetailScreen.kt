package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.nantty.android.data.BuyerDispute
import com.nantty.android.data.DisputeMessage
import com.nantty.android.data.DisputeRepository
import com.nantty.android.data.DisputeRepositoryResult
import com.nantty.android.data.WalletMoney
import com.nantty.android.data.formatWalletAmount
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executor

@Composable
internal fun BuyerDisputeDetailScreen(
    disputeId: String,
    repository: DisputeRepository,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var result by remember(disputeId) { mutableStateOf<DisputeRepositoryResult<BuyerDispute>?>(null) }
    var reloadGeneration by remember(disputeId) { mutableIntStateOf(0) }
    var requestGeneration by remember(disputeId) { mutableIntStateOf(0) }
    var draft by remember(disputeId) { mutableStateOf("") }
    var sending by remember(disputeId) { mutableStateOf(false) }
    var sendFailure by remember(disputeId) { mutableStateOf<DisputeRepositoryResult.Failure?>(null) }

    LaunchedEffect(disputeId, reloadGeneration) {
        val request = ++requestGeneration
        result = null
        executor.execute {
            val loaded = repository.loadDispute(disputeId)
            androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                if (requestGeneration == request) result = loaded
            }
        }
    }

    Column(modifier.fillMaxSize().imePadding()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
            Text("Dispute", Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            IconButton(onClick = { reloadGeneration += 1 }) {
                Icon(Icons.Default.Refresh, contentDescription = "Refresh dispute")
            }
        }

        when (val current = result) {
            null -> Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                CircularProgressIndicator()
                Text("Loading dispute", Modifier.padding(top = 12.dp), color = MaterialTheme.colorScheme.secondary)
            }
            is DisputeRepositoryResult.Failure -> Column(
                Modifier.fillMaxSize().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text(if (current.authenticationRequired) "Sign in to continue" else "Dispute unavailable", style = MaterialTheme.typography.titleMedium)
                Text(current.message, Modifier.padding(vertical = 12.dp), textAlign = TextAlign.Center)
                Button(onClick = if (current.authenticationRequired) onReauthenticate else ({ reloadGeneration += 1 })) {
                    Text(if (current.authenticationRequired) "Sign in again" else "Try again")
                }
            }
            is DisputeRepositoryResult.Success<BuyerDispute> -> {
                val dispute = current.value
                val resolved = dispute.status.startsWith("resolved") || dispute.status == "closed"
                val sellerMustRespond = dispute.viewerRole == "seller" && dispute.status == "awaiting_seller"
                LazyColumn(
                    Modifier.weight(1f).fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                ) {
                    item { DisputeSummaryCard(dispute, sellerMustRespond) }
                    item {
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text("Status", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                                dispute.statusHistory.forEach { event ->
                                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                        Text(event.label, fontWeight = FontWeight.Medium)
                                        Text(formatDisputeDateTime(event.occurredAt), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
                                    }
                                }
                                dispute.resolutionNote?.let { Text(it, color = MaterialTheme.colorScheme.secondary) }
                            }
                        }
                    }
                    item { Text("Messages with support", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold) }
                    items(dispute.messages, key = DisputeMessage::id) { message ->
                        DisputeMessageRow(message, sentByViewer = message.authorRole == dispute.viewerRole)
                    }
                    if (sendFailure != null) {
                        item {
                            Text(
                                sendFailure?.message.orEmpty(),
                                Modifier.fillMaxWidth(),
                                color = MaterialTheme.colorScheme.error,
                                textAlign = TextAlign.Center,
                            )
                            if (sendFailure?.authenticationRequired == true) {
                                TextButton(onClick = onReauthenticate, modifier = Modifier.fillMaxWidth()) { Text("Sign in again") }
                            }
                        }
                    }
                }

                if (!resolved) {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.Bottom,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        OutlinedTextField(
                            value = draft,
                            onValueChange = { if (it.length <= MAX_DISPUTE_MESSAGE_LENGTH) draft = it },
                            modifier = Modifier.weight(1f),
                            label = { Text(if (sellerMustRespond) "Reply to the buyer and support" else "Write a message") },
                            maxLines = 4,
                            supportingText = { Text("${draft.length}/$MAX_DISPUTE_MESSAGE_LENGTH") },
                        )
                        IconButton(
                            onClick = {
                                val message = draft.trim()
                                if (message.isEmpty() || sending) return@IconButton
                                sending = true
                                sendFailure = null
                                val key = UUID.randomUUID().toString()
                                executor.execute {
                                    val sent = repository.sendDisputeMessage(dispute.id, message, emptyList(), key)
                                    val refreshed = if (sent is DisputeRepositoryResult.Success<*>) repository.loadDispute(dispute.id) else null
                                    androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                        sending = false
                                        when (sent) {
                                            is DisputeRepositoryResult.Failure -> sendFailure = sent
                                            is DisputeRepositoryResult.Success<DisputeMessage> -> {
                                                draft = ""
                                                when (refreshed) {
                                                    is DisputeRepositoryResult.Success<BuyerDispute> -> result = refreshed
                                                    is DisputeRepositoryResult.Failure -> sendFailure = refreshed
                                                    null -> Unit
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            enabled = draft.isNotBlank() && !sending && sendFailure?.authenticationRequired != true,
                            modifier = Modifier.size(48.dp),
                        ) {
                            if (sending) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                            else Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send message")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DisputeSummaryCard(dispute: BuyerDispute, sellerMustRespond: Boolean) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(dispute.productName, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                DisputeStatusPill(dispute.status)
            }
            Text("${disputeReasonLabel(dispute.reason)} · ${formatWalletAmount(WalletMoney(dispute.amount.amountMinor, dispute.amount.currency))} held in escrow", color = MaterialTheme.colorScheme.secondary)
            Text("${if (dispute.viewerRole == "buyer") "Seller" else "Buyer"}: ${dispute.counterpartyName} · Opened ${formatDisputeDateTime(dispute.openedAt)}", color = MaterialTheme.colorScheme.secondary)
            if (sellerMustRespond) dispute.respondByAt?.let {
                Text("Respond by ${formatDisputeDateTime(it)} or support will decide without your input.", color = MaterialTheme.colorScheme.error)
            }
            Text(dispute.description)
            if (dispute.evidenceUrls.isNotEmpty()) {
                androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(dispute.evidenceUrls) { url ->
                        AsyncImage(model = url, contentDescription = "Dispute evidence", modifier = Modifier.size(96.dp).clip(RoundedCornerShape(8.dp)))
                    }
                }
            }
        }
    }
}

@Composable
private fun DisputeStatusPill(status: String) {
    val label = when (status) {
        "open" -> "Opened"
        "awaiting_seller" -> "Waiting for seller"
        "under_review" -> "Under review"
        "resolved_refunded" -> "Refunded"
        "resolved_released" -> "Paid to seller"
        "closed" -> "Closed"
        else -> "Status"
    }
    Surface(shape = RoundedCornerShape(50), color = MaterialTheme.colorScheme.primaryContainer) {
        Text(label, Modifier.padding(horizontal = 10.dp, vertical = 5.dp), color = MaterialTheme.colorScheme.onPrimaryContainer, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
private fun DisputeMessageRow(message: DisputeMessage, sentByViewer: Boolean) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (sentByViewer) Arrangement.End else Arrangement.Start) {
        Surface(
            modifier = Modifier.fillMaxWidth(0.88f),
            shape = RoundedCornerShape(16.dp),
            color = if (sentByViewer) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainerLow,
        ) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(message.authorName, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.secondary)
                Text(message.text)
                message.attachmentUrls.forEach { url ->
                    AsyncImage(model = url, contentDescription = "Message attachment", modifier = Modifier.size(160.dp).clip(RoundedCornerShape(8.dp)))
                }
                Text(formatDisputeDateTime(message.createdAt), Modifier.fillMaxWidth(), style = MaterialTheme.typography.labelSmall, textAlign = TextAlign.End, color = MaterialTheme.colorScheme.secondary)
            }
        }
    }
}

private fun disputeReasonLabel(reason: String): String = when (reason) {
    "not_received" -> "I didn't receive my order"
    "not_as_described" -> "Item isn't as described"
    "damaged" -> "Item arrived damaged"
    "wrong_item" -> "I received the wrong item"
    else -> "Something else"
}

private fun formatDisputeDateTime(value: String): String = runCatching {
    DateTimeFormatter.ofPattern("d MMM, HH:mm", Locale.getDefault())
        .format(Instant.parse(value).atZone(ZoneId.systemDefault()))
}.getOrDefault(value)

private const val MAX_DISPUTE_MESSAGE_LENGTH = 1_000
