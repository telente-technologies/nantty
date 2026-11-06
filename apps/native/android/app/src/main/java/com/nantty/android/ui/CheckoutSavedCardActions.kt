package com.nantty.android.ui

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
internal fun CheckoutSavedCardStatusAction(
    status: String,
    busy: Boolean,
    onCheckPaymentStatus: () -> Unit,
) {
    Text(status, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    OutlinedButton(enabled = !busy, onClick = onCheckPaymentStatus, modifier = Modifier.fillMaxWidth()) {
        if (busy) CircularProgressIndicator(Modifier, strokeWidth = 2.dp) else Text("Check payment status")
    }
}

@Composable
internal fun CheckoutSecurePaymentFallbackAction(
    visible: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    if (visible) {
        OutlinedButton(enabled = enabled, onClick = onClick, modifier = Modifier.fillMaxWidth()) {
            Text("Use secure payment instead")
        }
    }
}
