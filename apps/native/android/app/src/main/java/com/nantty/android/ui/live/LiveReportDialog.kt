package com.nantty.android.ui.live

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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.nantty.android.R
import com.nantty.android.data.LiveReportReason
import com.nantty.android.data.ProductReportRepository
import com.nantty.android.data.ProductReportResult
import java.time.Instant
import java.util.UUID
import java.util.concurrent.Executor
import kotlinx.coroutines.delay

private val liveReportReasons = listOf(
    LiveReportReason.CHILD_SAFETY to R.string.live_report_child_safety,
    LiveReportReason.SELF_HARM to R.string.live_report_self_harm,
    LiveReportReason.VIOLENCE to R.string.live_report_violence,
    LiveReportReason.SEXUAL_CONTENT to R.string.live_report_sexual_content,
    LiveReportReason.HATE to R.string.live_report_hate,
    LiveReportReason.HARASSMENT to R.string.live_report_harassment,
    LiveReportReason.SCAM to R.string.live_report_scam,
    LiveReportReason.INTELLECTUAL_PROPERTY to R.string.live_report_ip,
    LiveReportReason.OTHER to R.string.live_report_other,
)

@Composable
internal fun LiveReportDialog(
    visible: Boolean,
    liveId: String,
    liveStartedAt: String?,
    repository: ProductReportRepository,
    executor: Executor,
    onDismiss: () -> Unit,
    onReauthenticate: () -> Unit,
) {
    if (!visible) return
    var reason by remember(liveId) { mutableStateOf<LiveReportReason?>(null) }
    var details by remember(liveId) { mutableStateOf("") }
    var result by remember(liveId) { mutableStateOf<ProductReportResult?>(null) }
    var submitting by remember(liveId) { mutableStateOf(false) }
    var idempotencyKey by remember(liveId) { mutableStateOf(UUID.randomUUID().toString()) }
    var cooldownRemaining by remember(liveId) { mutableLongStateOf(LiveReportCooldown.remaining(liveId)) }
    LaunchedEffect(liveId) {
        while (true) {
            cooldownRemaining = LiveReportCooldown.remaining(liveId)
            delay(LIVE_REPORT_COOLDOWN_TICK_MS)
        }
    }

    fun submit() {
        val selectedReason = reason ?: return
        if (submitting || result is ProductReportResult.Success || cooldownRemaining > 0) return
        val captured = Instant.now()
        val start = liveStartedAt?.let { runCatching { Instant.parse(it) }.getOrNull() }
        val offset = start?.let { ((captured.toEpochMilli() - it.toEpochMilli()).coerceAtLeast(0) / 1_000L) }
        val key = idempotencyKey
        submitting = true
        executor.execute {
            val submitted = repository.submitLive(liveId, selectedReason, details, captured.toString(), offset, key)
            Snapshot.withMutableSnapshot {
                submitting = false
                result = submitted
                if (submitted is ProductReportResult.Success) LiveReportCooldown.remember(liveId)
                if (submitted is ProductReportResult.Failure) {
                    if (submitted.authenticationRequired) onReauthenticate()
                    if (submitted.rotateIdempotencyKeyOnRetry) idempotencyKey = UUID.randomUUID().toString()
                }
            }
        }
    }

    val submitted = result is ProductReportResult.Success
    AlertDialog(
        onDismissRequest = { if (!submitting) onDismiss() },
        title = { Text(stringResource(if (submitted) R.string.live_report_success_title else R.string.live_report_title)) },
        text = {
            if (submitted) {
                Text(stringResource(R.string.live_report_success_message))
            } else {
                Column(
                    Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(stringResource(R.string.live_report_question), style = MaterialTheme.typography.bodyMedium)
                    liveReportReasons.forEach { (option, labelResource) ->
                        val label = stringResource(labelResource)
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(
                                selected = reason == option,
                                onClick = { reason = option },
                                enabled = !submitting,
                                modifier = Modifier.testTag("live-report-reason-${option.name.lowercase()}"),
                            )
                            Text(label, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                    if (reason in setOf(LiveReportReason.CHILD_SAFETY, LiveReportReason.SELF_HARM, LiveReportReason.VIOLENCE)) {
                        Text(stringResource(R.string.live_report_urgent_notice), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }
                    if (reason == LiveReportReason.SELF_HARM) {
                        Text(stringResource(R.string.live_report_self_harm_notice), style = MaterialTheme.typography.bodySmall)
                    }
                    OutlinedTextField(
                        value = details,
                        onValueChange = { details = it.take(LIVE_REPORT_MAX_DETAILS_LENGTH) },
                        label = { Text(stringResource(R.string.live_report_details)) },
                        enabled = !submitting,
                        minLines = 2,
                        maxLines = 4,
                        supportingText = { Text(stringResource(R.string.live_report_detail_count, details.length, LIVE_REPORT_MAX_DETAILS_LENGTH)) },
                        modifier = Modifier.fillMaxWidth().testTag("live-report-details"),
                    )
                    Text(stringResource(R.string.live_report_context), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    (result as? ProductReportResult.Failure)?.let { Text(it.message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                    if (cooldownRemaining > 0) {
                        Text(
                            stringResource(R.string.live_report_cooldown, ((cooldownRemaining + 999) / 1_000).coerceAtLeast(1)),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        },
        confirmButton = {
            when {
                submitted -> TextButton(onClick = onDismiss) { Text(stringResource(R.string.report_product_dismiss)) }
                submitting -> CircularProgressIndicator(Modifier.padding(8.dp))
                reason != null -> Button(onClick = ::submit, enabled = cooldownRemaining <= 0, modifier = Modifier.testTag("live-report-submit")) { Text(stringResource(R.string.report_account_submit)) }
                else -> Unit
            }
        },
        dismissButton = { if (!submitted && !submitting) TextButton(onClick = onDismiss) { Text(stringResource(android.R.string.cancel)) } },
    )
}

private object LiveReportCooldown {
    private val lastSentAt = mutableMapOf<String, Long>()

    @Synchronized fun remaining(liveId: String, now: Long = System.currentTimeMillis()): Long {
        val lastSent = lastSentAt[liveId] ?: return 0L
        return (LIVE_REPORT_COOLDOWN_MS - (now - lastSent)).coerceAtLeast(0L)
    }

    @Synchronized fun remember(liveId: String, now: Long = System.currentTimeMillis()) {
        lastSentAt[liveId] = now
    }
}

private const val LIVE_REPORT_COOLDOWN_MS = 60_000L
private const val LIVE_REPORT_COOLDOWN_TICK_MS = 1_000L
private const val LIVE_REPORT_MAX_DETAILS_LENGTH = 500
