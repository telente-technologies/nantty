package com.nantty.android.ui

import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.nantty.android.data.BuyerDispute
import com.nantty.android.data.DisputeRepository
import com.nantty.android.data.DisputeRepositoryResult
import com.nantty.android.data.CreatorSampleMediaRepository
import com.nantty.android.data.CreatorSampleMediaResult
import java.util.UUID
import java.util.concurrent.Executor

internal data class BuyerDisputeReasonOption(
    val id: String,
    val label: String,
    val hint: String,
)

internal val BUYER_DISPUTE_REASON_OPTIONS = listOf(
    BuyerDisputeReasonOption("not_received", "I didn't receive my order", "Tracking shows delivered or it's very late"),
    BuyerDisputeReasonOption("not_as_described", "Item isn't as described", "Different colour, size, quality or model"),
    BuyerDisputeReasonOption("damaged", "Item arrived damaged", "Broken, cracked, leaking or torn"),
    BuyerDisputeReasonOption("wrong_item", "I received the wrong item", "Not what I ordered at all"),
    BuyerDisputeReasonOption("other", "Something else", "Tell us what happened"),
)

internal fun buyerDisputeSubmitReadiness(reason: String?, description: String, photoCount: Int, uploading: Boolean): Boolean {
    val descriptionLength = description.trim().length
    val requiresPhoto = reason in REQUIRED_PHOTO_REASONS
    return reason in BUYER_DISPUTE_REASON_OPTIONS.map(BuyerDisputeReasonOption::id) &&
        descriptionLength in MINIMUM_DESCRIPTION_LENGTH..MAXIMUM_DESCRIPTION_LENGTH &&
        photoCount in 0..MAXIMUM_EVIDENCE_PHOTOS && (!requiresPhoto || photoCount > 0) && !uploading
}

/** Buyer-facing dispute opening form. Parent owns navigation and handles success via [onCreated]. */
@Composable
internal fun BuyerOpenDisputeScreen(
    orderId: String,
    repository: DisputeRepository,
    mediaRepository: CreatorSampleMediaRepository,
    executor: Executor,
    onBack: () -> Unit,
    onReauthenticate: () -> Unit,
    onCreated: (disputeId: String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current.applicationContext
    var reason by remember { mutableStateOf<String?>(null) }
    var description by remember { mutableStateOf("") }
    val evidenceUrls = remember { mutableStateListOf<String>() }
    var uploading by remember { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }
    var failure by remember { mutableStateOf<String?>(null) }
    var authenticationRequired by remember { mutableStateOf(false) }
    val idempotencyKey = remember { UUID.randomUUID().toString().replace('-', '_') }
    var activeUpload by remember { mutableStateOf<CancellationSignal?>(null) }
    val currentUpload by rememberUpdatedState(activeUpload)
    val currentOnCreated by rememberUpdatedState(onCreated)
    val ready = buyerDisputeSubmitReadiness(reason, description, evidenceUrls.size, uploading)

    DisposableEffect(Unit) {
        onDispose { currentUpload?.cancel() }
    }

    Column(
        modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack, enabled = !submitting) { Text("Back") }
            Text("Open a dispute", style = MaterialTheme.typography.titleLarge)
        }
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Your payment is paused while we look into this", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
                Text("The seller can't receive the money until the dispute is resolved. They have 48 hours to respond, then Nantty support steps in.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("What went wrong?", style = MaterialTheme.typography.titleMedium)
            BUYER_DISPUTE_REASON_OPTIONS.forEach { option ->
                Card(
                    onClick = { if (!submitting) reason = option.id },
                    enabled = !submitting,
                    colors = CardDefaults.cardColors(
                        containerColor = if (reason == option.id) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surface,
                    ),
                ) {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = reason == option.id, onClick = { if (!submitting) reason = option.id }, enabled = !submitting)
                        Column(Modifier.weight(1f)) {
                            Text(option.label, style = MaterialTheme.typography.bodyLarge)
                            Text(option.hint, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Describe the problem", style = MaterialTheme.typography.titleMedium)
            OutlinedTextField(
                value = description,
                onValueChange = { description = it.take(MAXIMUM_DESCRIPTION_LENGTH) },
                enabled = !submitting,
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("E.g. The heel of the left shoe is peeling and there's a glue stain on the toe.") },
                minLines = 4,
                maxLines = 8,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                supportingText = {
                    val length = description.trim().length
                    Text(if (length < MINIMUM_DESCRIPTION_LENGTH) "At least $MINIMUM_DESCRIPTION_LENGTH characters" else "$length/$MAXIMUM_DESCRIPTION_LENGTH")
                },
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            val photoRequired = reason in REQUIRED_PHOTO_REASONS
            Text("Photo evidence${if (photoRequired) "" else " (optional)"}", style = MaterialTheme.typography.titleMedium)
            Text("Clear photos of the item, packaging and label help us resolve this faster. Only you, the seller and Nantty support can see them.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            DisputeEvidencePicker(
                mediaRepository = mediaRepository,
                executor = executor,
                evidenceUrls = evidenceUrls,
                onAddEvidence = { url -> if (url !in evidenceUrls && evidenceUrls.size < MAXIMUM_EVIDENCE_PHOTOS) evidenceUrls.add(url) },
                onRemoveEvidence = evidenceUrls::remove,
                enabled = !submitting,
                onUploadingChange = { uploading = it },
                onReauthenticate = onReauthenticate,
            )
        }

        if (failure != null) {
            Text(failure!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive })
            if (authenticationRequired) TextButton(onClick = onReauthenticate, enabled = !submitting) { Text("Sign in again") }
        }
        Spacer(Modifier.padding(bottom = 4.dp))
        Button(
            onClick = {
                val selectedReason = reason ?: return@Button
                if (!buyerDisputeSubmitReadiness(selectedReason, description, evidenceUrls.size, uploading) || submitting) return@Button
                submitting = true
                failure = null
                authenticationRequired = false
                val submittedDescription = description.trim()
                val submittedEvidence = evidenceUrls.toList()
                executor.execute {
                    val result = repository.openDispute(orderId, selectedReason, submittedDescription, submittedEvidence, idempotencyKey)
                    Snapshot.withMutableSnapshot {
                        submitting = false
                        when (result) {
                            is DisputeRepositoryResult.Success<BuyerDispute> -> failure = null
                            is DisputeRepositoryResult.Failure -> {
                                failure = result.message
                                authenticationRequired = result.authenticationRequired
                            }
                        }
                    }
                    if (result is DisputeRepositoryResult.Success<BuyerDispute>) {
                        Handler(Looper.getMainLooper()).post { currentOnCreated(result.value.id) }
                    }
                }
            },
            enabled = ready && !submitting,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (submitting) "Submitting…" else "Submit dispute")
        }
    }
}

private const val MINIMUM_DESCRIPTION_LENGTH = 20
private const val MAXIMUM_DESCRIPTION_LENGTH = 1_000
private const val MAXIMUM_EVIDENCE_PHOTOS = 5
private val REQUIRED_PHOTO_REASONS = setOf("damaged", "not_as_described", "wrong_item")
