package com.nantty.android.ui.stories

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.nantty.android.R
import com.nantty.android.data.ProductReportReason
import com.nantty.android.data.ProductReportRepository
import com.nantty.android.data.ProductReportResult
import com.nantty.android.data.StoryItem
import java.util.UUID
import java.util.concurrent.Executor
import java.util.concurrent.atomic.AtomicInteger

private data class StoryReportOption(val reason: ProductReportReason, val labelResource: Int)

private val storyReportOptions = listOf(
    StoryReportOption(ProductReportReason.SPAM, R.string.report_product_reason_spam),
    StoryReportOption(ProductReportReason.SCAM_OR_FRAUD, R.string.report_product_reason_scam),
    StoryReportOption(ProductReportReason.NUDITY_OR_SEXUAL_CONTENT, R.string.report_product_reason_nudity),
    StoryReportOption(ProductReportReason.HATE_OR_HARASSMENT, R.string.report_product_reason_hate),
    StoryReportOption(ProductReportReason.VIOLENCE, R.string.report_product_reason_violence),
    StoryReportOption(ProductReportReason.INTELLECTUAL_PROPERTY, R.string.report_product_reason_ip),
    StoryReportOption(ProductReportReason.SOMETHING_ELSE, R.string.report_product_reason_other),
)

@Composable
internal fun StoryReportDialog(
    repository: ProductReportRepository,
    story: StoryItem,
    executor: Executor,
    onDismiss: () -> Unit,
    onReauthenticate: () -> Unit,
) {
    var selectedReason by remember(story.id) { mutableStateOf<ProductReportReason?>(null) }
    var details by remember(story.id) { mutableStateOf("") }
    var result by remember(story.id) { mutableStateOf<ProductReportResult?>(null) }
    var submitting by remember(story.id) { mutableStateOf(false) }
    var idempotencyKey by remember(story.id) { mutableStateOf(UUID.randomUUID().toString()) }
    val generation = remember(story.id) { AtomicInteger() }
    DisposableEffect(generation) { onDispose { generation.incrementAndGet() } }

    fun submit() {
        val reason = selectedReason ?: return
        if (submitting || result is ProductReportResult.Success) return
        submitting = true
        val requestId = generation.get()
        val key = idempotencyKey
        executor.execute {
            val submitted = repository.submitUser(story.authorId, reason, details, key)
            if (generation.get() != requestId) return@execute
            Snapshot.withMutableSnapshot {
                submitting = false
                result = submitted
                if (submitted is ProductReportResult.Failure) {
                    if (submitted.authenticationRequired) onReauthenticate()
                    if (submitted.rotateIdempotencyKeyOnRetry) idempotencyKey = UUID.randomUUID().toString()
                }
            }
        }
    }

    val success = result is ProductReportResult.Success
    AlertDialog(
        onDismissRequest = { if (!submitting) onDismiss() },
        title = { Text(stringResource(if (success) R.string.report_account_success_title else R.string.report_account_title)) },
        text = {
            if (success) {
                Text(stringResource(R.string.report_account_success_message))
            } else {
                Column(
                    Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(stringResource(R.string.report_account_description), style = MaterialTheme.typography.bodyMedium)
                    storyReportOptions.forEach { option ->
                        val label = stringResource(option.labelResource)
                        Row(
                            Modifier.fillMaxWidth().semantics { contentDescription = label },
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = selectedReason == option.reason,
                                onClick = { selectedReason = option.reason },
                                enabled = !submitting,
                            )
                            Text(label, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                    OutlinedTextField(
                        value = details,
                        onValueChange = { details = it.take(MAX_REPORT_DETAILS_LENGTH) },
                        label = { Text(stringResource(R.string.report_account_details_label)) },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !submitting,
                        minLines = 2,
                        maxLines = 4,
                        supportingText = { Text("${details.length}/$MAX_REPORT_DETAILS_LENGTH") },
                    )
                    (result as? ProductReportResult.Failure)?.let { failure ->
                        Text(failure.message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        },
        confirmButton = {
            when {
                success -> TextButton(onClick = onDismiss) { Text(stringResource(R.string.report_product_dismiss)) }
                submitting -> CircularProgressIndicator(Modifier.padding(8.dp))
                selectedReason != null -> Button(onClick = ::submit) { Text(stringResource(R.string.report_account_submit)) }
                else -> TextButton(onClick = onDismiss, modifier = Modifier.testTag("story-report-dismiss")) { Text(stringResource(android.R.string.cancel)) }
            }
        },
        dismissButton = {
            if (!success && !submitting) {
                (result as? ProductReportResult.Failure)?.takeIf { it.retryable }?.let {
                    TextButton(onClick = ::submit, enabled = selectedReason != null) { Text(stringResource(R.string.report_product_retry)) }
                }
            }
        },
    )
}

private const val MAX_REPORT_DETAILS_LENGTH = 500
