package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.nantty.android.R
import com.nantty.android.data.ProductReportReason

private data class ProductReportOption(val reason: ProductReportReason, val labelResource: Int)

private val productReportOptions = listOf(
    ProductReportOption(ProductReportReason.COUNTERFEIT_PRODUCT, R.string.report_product_reason_counterfeit),
    ProductReportOption(ProductReportReason.SPAM, R.string.report_product_reason_spam),
    ProductReportOption(ProductReportReason.SCAM_OR_FRAUD, R.string.report_product_reason_scam),
    ProductReportOption(ProductReportReason.NUDITY_OR_SEXUAL_CONTENT, R.string.report_product_reason_nudity),
    ProductReportOption(ProductReportReason.HATE_OR_HARASSMENT, R.string.report_product_reason_hate),
    ProductReportOption(ProductReportReason.VIOLENCE, R.string.report_product_reason_violence),
    ProductReportOption(ProductReportReason.INTELLECTUAL_PROPERTY, R.string.report_product_reason_ip),
    ProductReportOption(ProductReportReason.SOMETHING_ELSE, R.string.report_product_reason_other),
)

@Composable
internal fun ProductReportDialog(
    visible: Boolean,
    submitting: Boolean,
    submitted: Boolean,
    selectedReason: ProductReportReason?,
    errorMessage: String?,
    canRetry: Boolean,
    onDismiss: () -> Unit,
    onSelectReason: (ProductReportReason) -> Unit,
    onRetry: () -> Unit,
) {
    if (!visible) return

    AlertDialog(
        onDismissRequest = { if (!submitting) onDismiss() },
        title = {
            Text(stringResource(if (submitted) R.string.report_product_success_title else R.string.report_product_title))
        },
        text = {
            if (submitted) {
                Text(stringResource(R.string.report_product_success_message))
            } else {
                Column(
                    modifier = Modifier.heightIn(max = 440.dp).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    Text(stringResource(R.string.report_product_description), style = MaterialTheme.typography.bodyMedium)
                    productReportOptions.forEach { option ->
                        val label = stringResource(option.labelResource)
                        TextButton(
                            onClick = { onSelectReason(option.reason) },
                            enabled = !submitting,
                            modifier = Modifier.fillMaxWidth().semantics { contentDescription = label },
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                if (submitting && selectedReason == option.reason) {
                                    CircularProgressIndicator()
                                } else {
                                    Icon(Icons.Outlined.Flag, contentDescription = null)
                                }
                                Text(label, modifier = Modifier.weight(1f))
                            }
                        }
                    }
                    if (submitting) {
                        Text(stringResource(R.string.report_product_submitting), style = MaterialTheme.typography.bodySmall)
                    }
                    errorMessage?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
                }
            }
        },
        confirmButton = {
            when {
                submitted -> TextButton(onClick = onDismiss) { Text(stringResource(R.string.report_product_dismiss)) }
                errorMessage != null && selectedReason != null && canRetry -> TextButton(onClick = onRetry, enabled = !submitting) {
                    Text(stringResource(R.string.report_product_retry))
                }
                else -> TextButton(onClick = onDismiss, enabled = !submitting) { Text(stringResource(android.R.string.cancel)) }
            }
        },
    )
}
