package com.nantty.android.ui.spaces

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.nantty.android.data.ProductReportReason
import com.nantty.android.data.ProductReportResult

@Composable
internal fun SpaceReportDialog(
    spaceTitle: String,
    selectedReason: ProductReportReason,
    details: String,
    result: ProductReportResult?,
    submitting: Boolean,
    onReasonChange: (ProductReportReason) -> Unit,
    onDetailsChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onDismiss: () -> Unit,
) {
    val success = result as? ProductReportResult.Success
    val failure = result as? ProductReportResult.Failure
    AlertDialog(
        onDismissRequest = { if (!submitting) onDismiss() },
        title = { Text(if (success == null) "Report this Space" else "Report received") },
        text = {
            Column {
                if (success != null) {
                    Text("Thanks for helping keep Nantty safe. Our moderation team received your report.")
                } else {
                    Text("Tell us why you’re reporting ‘$spaceTitle’. The report is private.", style = MaterialTheme.typography.bodyMedium)
                    listOf(
                        ProductReportReason.SPAM to "Spam",
                        ProductReportReason.SCAM_OR_FRAUD to "Scam or fraud",
                        ProductReportReason.HATE_OR_HARASSMENT to "Hate or harassment",
                        ProductReportReason.NUDITY_OR_SEXUAL_CONTENT to "Sexual content",
                        ProductReportReason.VIOLENCE to "Violence",
                        ProductReportReason.SOMETHING_ELSE to "Something else",
                    ).forEach { (reason, label) ->
                        Row(
                            Modifier.fillMaxWidth().selectable(
                                selected = selectedReason == reason,
                                onClick = { onReasonChange(reason) },
                                role = Role.RadioButton,
                            ).padding(vertical = 1.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(selected = selectedReason == reason, onClick = null)
                            Text(label, modifier = Modifier.padding(start = 8.dp))
                        }
                    }
                    OutlinedTextField(
                        value = details,
                        onValueChange = { value -> if (value.toByteArray(Charsets.UTF_8).size <= 500) onDetailsChange(value) },
                        label = { Text("Additional details (optional)") },
                        supportingText = { Text("${details.toByteArray(Charsets.UTF_8).size}/500 bytes") },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !submitting,
                    )
                    if (failure != null) Text(failure.message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            if (success != null) {
                TextButton(onClick = onDismiss) { Text("Done") }
            } else {
                Button(onClick = onSubmit, enabled = !submitting) {
                    Text(if (submitting) "Submitting…" else "Submit report")
                }
            }
        },
        dismissButton = {
            if (success == null) TextButton(onClick = onDismiss, enabled = !submitting) { Text("Cancel") }
        },
    )
}
