package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.BuyerOrderDetail
import com.nantty.android.data.BuyerOrderReturnRequestResult
import com.nantty.android.data.BuyerReturnReceipt
import com.nantty.android.data.BuyerReturnStatusResult
import com.nantty.android.data.BuyerReturnsRepository
import com.nantty.android.data.BuyerReturnLineRequest
import com.nantty.android.data.buyerCanRequestReturn
import java.util.concurrent.Executor

@Composable
internal fun BuyerReturnRequestSection(
    order: BuyerOrderDetail,
    repository: BuyerReturnsRepository,
    executor: Executor,
    onAuthenticationRequired: () -> Unit,
) {
    if (!buyerCanRequestReturn(order.status)) return

    var refresh by remember(order.id) { mutableIntStateOf(0) }
    var statusResult by remember(order.id) { mutableStateOf<BuyerReturnStatusResult?>(null) }
    var requestResult by remember(order.id) { mutableStateOf<BuyerOrderReturnRequestResult?>(null) }
    var expanded by remember(order.id) { mutableStateOf(false) }
    var reason by remember(order.id) { mutableStateOf("") }
    var submitting by remember(order.id) { mutableStateOf(false) }
    var selectionError by remember(order.id) { mutableStateOf<String?>(null) }
    val quantities = remember(order.id) { mutableStateMapOf<String, Int>() }
    val returnItems = remember(order.id, order.items) { order.items.filter { it.orderItemId != null && it.quantity > 0 } }
    val selectedLines = quantities.mapNotNull { (id, quantity) ->
        id.takeIf { quantity > 0 }?.let { BuyerReturnLineRequest(it, quantity) }
    }
    val reasonLength = reason.trim().length
    val canSubmit = !submitting && selectedLines.size in 1..BuyerReturnsRepository.MAX_RETURN_LINES &&
        reasonLength in BuyerReturnsRepository.MIN_RETURN_REASON_LENGTH..BuyerReturnsRepository.MAX_RETURN_REASON_LENGTH

    LaunchedEffect(order.id, repository, refresh) {
        statusResult = null
        executor.execute {
            val loaded = repository.loadForOrder(order.id)
            Snapshot.withMutableSnapshot { statusResult = loaded }
        }
    }

    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Returns", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            when (val status = statusResult) {
                null -> {
                    CircularProgressIndicator()
                    Text("Checking existing return requests", style = MaterialTheme.typography.bodySmall)
                }
                is BuyerReturnStatusResult.Failure -> {
                    Text(status.message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    if (status.authenticationRequired) {
                        TextButton(onClick = onAuthenticationRequired) { Text("Sign in again") }
                    } else {
                        TextButton(onClick = { refresh += 1 }) { Text("Retry") }
                    }
                }
                is BuyerReturnStatusResult.Success -> {
                    val existingRequest = (requestResult as? BuyerOrderReturnRequestResult.Success)?.receipt ?: status.request
                    if (existingRequest != null) {
                        BuyerReturnReceiptCard(
                            existingRequest,
                            submittedNow = requestResult is BuyerOrderReturnRequestResult.Success,
                        )
                    }
                    val activeRequestKnown = existingRequest?.status in setOf("requested", "approved")
                    if (!activeRequestKnown && requestResult !is BuyerOrderReturnRequestResult.Success) {
                        Text("Nantty will confirm whether this order is eligible for a return.", style = MaterialTheme.typography.bodySmall)
                        if (!expanded) {
                            OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
                                Text("Request a return")
                            }
                        } else {
                            ReturnRequestForm(
                                order = order,
                                items = returnItems,
                                quantities = quantities,
                                reason = reason,
                                submitting = submitting,
                                canSubmit = canSubmit,
                                selectionError = selectionError,
                                requestResult = requestResult,
                                onReasonChanged = { reason = it.take(BuyerReturnsRepository.MAX_RETURN_REASON_LENGTH) },
                                onQuantityChanged = { id, quantity ->
                                    selectionError = null
                                    if (quantity == 0) quantities.remove(id)
                                    else if (id !in quantities && quantities.size >= BuyerReturnsRepository.MAX_RETURN_LINES) {
                                        selectionError = "Select no more than ${BuyerReturnsRepository.MAX_RETURN_LINES} items."
                                    } else quantities[id] = quantity
                                },
                                onSubmit = {
                                    if (!canSubmit) return@ReturnRequestForm
                                    submitting = true
                                    requestResult = null
                                    val requestLines = selectedLines.toList()
                                    val requestReason = reason.trim()
                                    executor.execute {
                                        val submitted = repository.requestReturn(order.id, requestLines, requestReason)
                                        Snapshot.withMutableSnapshot {
                                            submitting = false
                                            requestResult = submitted
                                            if (submitted is BuyerOrderReturnRequestResult.Success) {
                                                statusResult = BuyerReturnStatusResult.Success(submitted.receipt)
                                                expanded = false
                                            }
                                        }
                                    }
                                },
                                onClose = { expanded = false },
                                onAuthenticationRequired = onAuthenticationRequired,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BuyerReturnReceiptCard(receipt: BuyerReturnReceipt, submittedNow: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            if (submittedNow) "Return request submitted"
            else if (receipt.status in setOf("requested", "approved")) "Return request in progress"
            else "Latest return request",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
        )
        Text("Status: ${receipt.status}", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("Request ${receipt.id}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        receipt.createdAt?.let { Text("Submitted: $it", style = MaterialTheme.typography.bodySmall) }
    }
}

@Composable
private fun ReturnRequestForm(
    order: BuyerOrderDetail,
    items: List<com.nantty.android.data.BuyerOrderItem>,
    quantities: Map<String, Int>,
    reason: String,
    submitting: Boolean,
    canSubmit: Boolean,
    selectionError: String?,
    requestResult: BuyerOrderReturnRequestResult?,
    onReasonChanged: (String) -> Unit,
    onQuantityChanged: (String, Int) -> Unit,
    onSubmit: () -> Unit,
    onClose: () -> Unit,
    onAuthenticationRequired: () -> Unit,
) {
    if (items.isEmpty()) {
        Text("Item details are unavailable for this order. Contact support for help.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    } else {
        Text("Select items and quantities", style = MaterialTheme.typography.titleSmall)
        selectionError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
        items.forEach { item ->
            val itemId = item.orderItemId ?: return@forEach
            val maxQuantity = minOf(item.quantity, BuyerReturnsRepository.MAX_RETURN_QUANTITY)
            val selected = quantities[itemId] ?: 0
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = selected > 0,
                        onCheckedChange = { checked -> onQuantityChanged(itemId, if (checked) 1 else 0) },
                        modifier = Modifier.semantics { contentDescription = "Select ${item.name} for return" },
                        enabled = !submitting && maxQuantity > 0,
                    )
                    Column(Modifier.weight(1f)) {
                        Text(item.name, style = MaterialTheme.typography.bodyLarge)
                        item.variant?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    }
                }
                if (selected > 0) {
                    Row(
                        Modifier.fillMaxWidth().padding(start = 52.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        TextButton(
                            onClick = { onQuantityChanged(itemId, if (selected <= 1) 0 else selected - 1) },
                            enabled = !submitting,
                            modifier = Modifier.semantics { contentDescription = "Decrease return quantity for ${item.name}" },
                        ) { Text("−") }
                        Text("Quantity: $selected of $maxQuantity")
                        TextButton(
                            onClick = { if (selected < maxQuantity) onQuantityChanged(itemId, selected + 1) },
                            enabled = !submitting && selected < maxQuantity,
                            modifier = Modifier.semantics { contentDescription = "Increase return quantity for ${item.name}" },
                        ) { Text("+") }
                    }
                }
            }
        }
    }
    OutlinedTextField(
        value = reason,
        onValueChange = onReasonChanged,
        modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Reason for return" },
        label = { Text("Reason for return") },
        supportingText = {
            Text("${reason.trim().length}/${BuyerReturnsRepository.MAX_RETURN_REASON_LENGTH} characters · at least ${BuyerReturnsRepository.MIN_RETURN_REASON_LENGTH} required")
        },
        minLines = 3,
        maxLines = 5,
        enabled = !submitting,
        isError = reason.isNotBlank() && reason.trim().length < BuyerReturnsRepository.MIN_RETURN_REASON_LENGTH,
    )
    (requestResult as? BuyerOrderReturnRequestResult.Failure)?.let { failure ->
        Text(failure.message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        if (failure.authenticationRequired) TextButton(onClick = onAuthenticationRequired) { Text("Sign in again") }
    }
    Button(
        onClick = onSubmit,
        enabled = canSubmit && items.isNotEmpty(),
        modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Submit return request for ${order.reference}" },
    ) {
        if (submitting) CircularProgressIndicator() else Text("Submit return request")
    }
    TextButton(onClick = onClose, enabled = !submitting) { Text("Close") }
}
