package com.nantty.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.nantty.android.R
import com.nantty.android.data.ProductReportReason
import com.nantty.android.data.ProductReportRepository
import com.nantty.android.data.ProductReportResult
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.FeedPost
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.UUID

@Composable
internal fun rememberFeedPostReportFlow(
    sessionRepository: AccountSessionRepository,
    isGuest: Boolean,
    onRequireSignIn: () -> Unit,
    onAuthenticationRequired: () -> Unit,
): (FeedPost) -> Unit {
    var reportingPostId by rememberSaveable { mutableStateOf<String?>(null) }
    val repository = remember(sessionRepository) {
        ProductReportRepository(accessTokenProvider = { sessionRepository.sessionOrNull()?.accessToken })
    }
    FeedPostReportDialog(
        postId = reportingPostId,
        repository = repository,
        onDismiss = { reportingPostId = null },
        onAuthenticationRequired = onAuthenticationRequired,
    )
    return remember(isGuest, onRequireSignIn) {
        { post: FeedPost -> if (isGuest) onRequireSignIn() else reportingPostId = post.id }
    }
}

private data class FeedReportOption(val reason: ProductReportReason, val labelResource: Int)

private val feedReportOptions = listOf(
    FeedReportOption(ProductReportReason.SPAM, R.string.report_product_reason_spam),
    FeedReportOption(ProductReportReason.SCAM_OR_FRAUD, R.string.report_product_reason_scam),
    FeedReportOption(ProductReportReason.COUNTERFEIT_PRODUCT, R.string.report_feed_reason_counterfeit),
    FeedReportOption(ProductReportReason.NUDITY_OR_SEXUAL_CONTENT, R.string.report_product_reason_nudity),
    FeedReportOption(ProductReportReason.HATE_OR_HARASSMENT, R.string.report_product_reason_hate),
    FeedReportOption(ProductReportReason.VIOLENCE, R.string.report_product_reason_violence),
    FeedReportOption(ProductReportReason.INTELLECTUAL_PROPERTY, R.string.report_product_reason_ip),
    FeedReportOption(ProductReportReason.SOMETHING_ELSE, R.string.report_product_reason_other),
)

@Composable
internal fun FeedPostReportDialog(
    postId: String?,
    repository: ProductReportRepository,
    onDismiss: () -> Unit,
    onAuthenticationRequired: () -> Unit,
    targetType: String = "post",
) {
    if (postId.isNullOrBlank()) return

    var selectedReason by rememberSaveable(postId) { mutableStateOf<ProductReportReason?>(null) }
    var details by rememberSaveable(postId) { mutableStateOf("") }
    var submitting by rememberSaveable(postId) { mutableStateOf(false) }
    var submitted by rememberSaveable(postId) { mutableStateOf(false) }
    var errorMessage by rememberSaveable(postId) { mutableStateOf<String?>(null) }
    var canRetry by rememberSaveable(postId) { mutableStateOf(false) }
    var idempotencyKey by rememberSaveable(postId) { mutableStateOf(UUID.randomUUID().toString()) }
    val scope = rememberCoroutineScope()

    fun submit() {
        val reason = selectedReason ?: return
        if (submitting) return
        submitting = true
        errorMessage = null
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                if (targetType == "comment") repository.submitComment(postId, reason, details.trim(), idempotencyKey)
                else repository.submitPost(postId, reason, details.trim(), idempotencyKey)
            }
            submitting = false
            when (result) {
                is ProductReportResult.Success -> submitted = true
                is ProductReportResult.Failure -> {
                    if (result.authenticationRequired) {
                        onDismiss()
                        onAuthenticationRequired()
                    } else {
                        errorMessage = result.message
                        canRetry = result.retryable
                        if (result.rotateIdempotencyKeyOnRetry) idempotencyKey = UUID.randomUUID().toString()
                    }
                }
            }
        }
    }

    AlertDialog(
        onDismissRequest = { if (!submitting) onDismiss() },
        title = { Text(stringResource(if (submitted) R.string.report_post_success_title else if (targetType == "comment") R.string.report_comment_title else R.string.report_post_title)) },
        text = {
            if (submitted) {
                Text(stringResource(if (targetType == "comment") R.string.report_comment_success_message else R.string.report_post_success_message))
            } else {
                Column(
                    modifier = Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(stringResource(if (targetType == "comment") R.string.report_comment_description else R.string.report_post_description), style = MaterialTheme.typography.bodyMedium)
                    feedReportOptions.forEach { option ->
                        val label = stringResource(option.labelResource)
                        Row(
                            modifier = Modifier.fillMaxWidth().clickable(enabled = !submitting) { selectedReason = option.reason }
                                .semantics { contentDescription = label },
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(
                                selected = selectedReason == option.reason,
                                onClick = { selectedReason = option.reason },
                                enabled = !submitting,
                            )
                            Text(label, modifier = Modifier.padding(start = 8.dp))
                        }
                    }
                    OutlinedTextField(
                        value = details,
                        onValueChange = { details = it.take(MAX_REPORT_DETAILS_LENGTH) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.report_post_details_label)) },
                        supportingText = { Text(stringResource(R.string.report_post_details_count, details.length, MAX_REPORT_DETAILS_LENGTH)) },
                        maxLines = 4,
                        enabled = !submitting,
                    )
                    if (submitting) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            CircularProgressIndicator()
                            Text(stringResource(R.string.report_product_submitting), style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
                }
            }
        },
        confirmButton = {
            when {
                submitted -> TextButton(onClick = onDismiss) { Text(stringResource(R.string.report_product_dismiss)) }
                errorMessage != null && canRetry -> TextButton(onClick = ::submit, enabled = !submitting) {
                    Text(stringResource(R.string.report_product_retry))
                }
                errorMessage != null -> TextButton(onClick = onDismiss) { Text(stringResource(R.string.report_product_dismiss)) }
                else -> TextButton(onClick = ::submit, enabled = selectedReason != null && !submitting) {
                    Text(stringResource(R.string.report_post_submit))
                }
            }
        },
        dismissButton = {
            if (!submitted) TextButton(onClick = onDismiss, enabled = !submitting) {
                Text(stringResource(android.R.string.cancel))
            }
        },
    )
}

private const val MAX_REPORT_DETAILS_LENGTH = 500
