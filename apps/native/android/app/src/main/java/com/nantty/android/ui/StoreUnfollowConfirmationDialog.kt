package com.nantty.android.ui

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable

@Composable
internal fun StoreUnfollowConfirmationDialog(
    visible: Boolean,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    if (!visible) return

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Unfollow store?") },
        text = { Text("You will no longer follow this store.") },
        confirmButton = { TextButton(onClick = onConfirm) { Text("Unfollow") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
