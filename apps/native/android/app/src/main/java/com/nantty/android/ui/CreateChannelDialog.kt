package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
internal fun CreateChannelDialog(
    name: String,
    description: String,
    busy: Boolean,
    error: String?,
    onNameChange: (String) -> Unit,
    onDescriptionChange: (String) -> Unit,
    onDismiss: () -> Unit,
    onCreate: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Create broadcast channel") },
        text = {
            Column(
                Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState()).padding(top = 4.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    "Create a public channel for followers. Channel posting on Android is unavailable until encrypted messaging compatibility is complete.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedTextField(
                    value = name,
                    onValueChange = { onNameChange(it.take(80)) },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !busy,
                    label = { Text("Channel name") },
                    supportingText = { Text("Required, up to 80 characters") },
                    singleLine = true,
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { onDescriptionChange(it.take(500)) },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !busy,
                    label = { Text("Description (optional)") },
                    supportingText = { Text("Up to 500 characters") },
                    minLines = 2,
                    maxLines = 4,
                )
                if (!error.isNullOrBlank()) {
                    Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onCreate, enabled = name.isNotBlank() && !busy) {
                Text(if (busy) "Creating…" else "Create channel")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !busy) { Text("Cancel") } },
    )
}
