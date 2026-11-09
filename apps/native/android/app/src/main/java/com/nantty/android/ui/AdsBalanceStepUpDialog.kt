package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.testTag
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation

internal enum class AdsBalanceStepUpMode { PASSWORD, EMAIL }

@Composable
internal fun AdsBalanceStepUpDialog(
    email: String,
    mode: AdsBalanceStepUpMode,
    codeSent: Boolean,
    password: String,
    code: String,
    busy: Boolean,
    error: String?,
    onPasswordChange: (String) -> Unit,
    onCodeChange: (String) -> Unit,
    onModeChange: (AdsBalanceStepUpMode) -> Unit,
    onSubmit: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Confirm it's you") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Confirm your identity before this withdrawal.", style = MaterialTheme.typography.bodySmall)
                when (mode) {
                    AdsBalanceStepUpMode.PASSWORD -> OutlinedTextField(
                        value = password,
                        onValueChange = onPasswordChange,
                        label = { Text("Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth().testTag("ads-balance-step-up-password"),
                    )
                    AdsBalanceStepUpMode.EMAIL -> if (codeSent) OutlinedTextField(
                        value = code,
                        onValueChange = { onCodeChange(it.filter(Char::isDigit).take(6)) },
                        label = { Text("6-digit code sent to $email") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        modifier = Modifier.fillMaxWidth().testTag("ads-balance-step-up-code"),
                    ) else Text("We'll email a sign-in code to $email.", style = MaterialTheme.typography.bodySmall)
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            }
        },
        confirmButton = {
            TextButton(onClick = onSubmit, enabled = !busy) {
                if (busy) CircularProgressIndicator() else Text(if (mode == AdsBalanceStepUpMode.EMAIL && !codeSent) "Email me a code" else "Confirm")
            }
        },
        dismissButton = {
            Row {
                if (email.isNotBlank()) TextButton(
                    onClick = { onModeChange(if (mode == AdsBalanceStepUpMode.PASSWORD) AdsBalanceStepUpMode.EMAIL else AdsBalanceStepUpMode.PASSWORD) },
                    enabled = !busy,
                ) { Text(if (mode == AdsBalanceStepUpMode.PASSWORD) "Use email code" else "Use password") }
                TextButton(onClick = onDismiss, enabled = !busy) { Text("Cancel") }
            }
        },
    )
}
