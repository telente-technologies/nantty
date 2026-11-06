package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.nantty.android.data.BuyerOrderItem
import com.nantty.android.data.ProductReviewSubmitResult
import com.nantty.android.data.ProductReviewsRepository
import java.util.UUID
import java.util.concurrent.Executor

@Composable
internal fun BuyerOrderReviewSection(
    status: String,
    products: List<BuyerOrderItem>,
    repository: ProductReviewsRepository,
    executor: Executor,
    onAuthenticationRequired: () -> Unit,
) {
    if (status != "delivered" && status != "completed") return
    val reviewedIds = remember(products) { mutableStateListOf<String>() }
    val eligibleProducts = products.filter { item ->
        item.productId != null && item.productId !in reviewedIds
    }.distinctBy { it.productId }
    var selected by remember { mutableStateOf<BuyerOrderItem?>(null) }
    if (eligibleProducts.isNotEmpty()) {
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Rate your purchase", style = MaterialTheme.typography.titleMedium)
                Text("Your review helps other buyers and the seller.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
                eligibleProducts.forEach { product ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(product.name, Modifier.weight(1f), maxLines = 1)
                        TextButton(
                            onClick = { selected = product },
                            modifier = Modifier.semantics { contentDescription = "Write a review for ${product.name}" },
                        ) { Text("Write review") }
                    }
                }
            }
        }
    }
    selected?.let { product ->
        BuyerWriteReviewDialog(
            product = product,
            repository = repository,
            executor = executor,
            onDismiss = { selected = null },
            onAuthenticationRequired = onAuthenticationRequired,
            onReviewed = { product.productId?.let(reviewedIds::add); selected = null },
        )
    }
}

@Composable
private fun BuyerWriteReviewDialog(
    product: BuyerOrderItem,
    repository: ProductReviewsRepository,
    executor: Executor,
    onDismiss: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    onReviewed: () -> Unit,
) {
    var rating by remember(product.productId) { mutableIntStateOf(0) }
    var title by remember(product.productId) { mutableStateOf("") }
    var text by remember(product.productId) { mutableStateOf("") }
    var error by remember(product.productId) { mutableStateOf<String?>(null) }
    var submitting by remember(product.productId) { mutableStateOf(false) }
    var idempotencyKey by remember(product.productId) { mutableStateOf(UUID.randomUUID().toString()) }

    AlertDialog(
        onDismissRequest = { if (!submitting) onDismiss() },
        title = { Text("Rate your purchase") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(product.name, style = MaterialTheme.typography.titleSmall)
                Text("How would you rate it?", style = MaterialTheme.typography.bodyMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    (1..5).forEach { value ->
                        TextButton(
                            onClick = { rating = value; error = null },
                            enabled = !submitting,
                            modifier = Modifier.semantics { contentDescription = "$value star${if (value == 1) "" else "s"}" },
                        ) { Text(if (value <= rating) "★" else "☆", style = MaterialTheme.typography.titleLarge) }
                    }
                }
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it.takeUtf8Bytes(120); idempotencyKey = UUID.randomUUID().toString() },
                    label = { Text("Title (optional)") },
                    enabled = !submitting,
                    singleLine = true,
                    supportingText = { Text("${title.toByteArray(Charsets.UTF_8).size}/120 bytes") },
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it.takeUtf8Bytes(2_000); error = null; idempotencyKey = UUID.randomUUID().toString() },
                    label = { Text("Your review") },
                    placeholder = { Text("What did you like or dislike?") },
                    enabled = !submitting,
                    minLines = 3,
                    maxLines = 5,
                    supportingText = { Text("${text.trim().toByteArray(Charsets.UTF_8).size}/2000 bytes") },
                    modifier = Modifier.fillMaxWidth(),
                )
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            }
        },
        confirmButton = {
            Button(
                enabled = !submitting,
                onClick = {
                    val cleanText = text.trim()
                    when {
                        rating !in 1..5 -> error = "Tap a star to rate this product."
                        cleanText.isEmpty() -> error = "Write a few words about the product."
                        cleanText.toByteArray(Charsets.UTF_8).size > 2_000 -> error = "Keep your review under 2000 characters."
                        title.trim().toByteArray(Charsets.UTF_8).size > 120 -> error = "Keep the title under 120 characters."
                        else -> {
                            submitting = true
                            error = null
                            executor.execute {
                                val result = repository.submitProductReview(product.productId.orEmpty(), rating, cleanText, title, idempotencyKey)
                                androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                                    submitting = false
                                    when (result) {
                                        ProductReviewSubmitResult.Success -> onReviewed()
                                        is ProductReviewSubmitResult.Failure -> {
                                            error = result.message
                                            if (result.authenticationRequired) onAuthenticationRequired()
                                            if (result.message == "You've already reviewed this product.") onReviewed()
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
            ) { Text(if (submitting) "Posting…" else "Post review") }
        },
        dismissButton = {
            OutlinedButton(enabled = !submitting, onClick = onDismiss) { Text("Cancel") }
        },
    )
}

internal fun String.takeUtf8Bytes(maxBytes: Int): String {
    if (maxBytes <= 0) return ""
    val result = StringBuilder()
    var bytes = 0
    var offset = 0
    while (offset < length) {
        val codePoint = codePointAt(offset)
        val character = String(Character.toChars(codePoint))
        val characterBytes = character.toByteArray(Charsets.UTF_8).size
        if (bytes + characterBytes > maxBytes) break
        result.append(character)
        bytes += characterBytes
        offset += Character.charCount(codePoint)
    }
    return result.toString()
}
