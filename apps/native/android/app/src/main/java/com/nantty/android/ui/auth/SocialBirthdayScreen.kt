package com.nantty.android.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.nantty.android.data.AuthValidation

@Composable
internal fun SocialBirthdayScreen(
    value: String,
    error: String?,
    busy: Boolean,
    onValueChange: (String) -> Unit,
    onContinue: () -> Unit,
    onBack: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(Modifier.widthIn(max = 520.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            TextButton(onClick = onBack, enabled = !busy) { Text("Back") }
            Text("When’s your birthday?", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.semantics { heading() })
            Text("We need this to finish creating your account. Your birthday won’t be shown publicly.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            OutlinedTextField(
                value = value,
                onValueChange = { input -> onValueChange(AuthValidation.formatBirthdayInput(input)) },
                modifier = Modifier.fillMaxWidth().semantics { if (error != null) error(error) },
                label = { Text("Birthday") },
                placeholder = { Text("dd/mm/yyyy") },
                supportingText = { if (error != null) Text(error, color = MaterialTheme.colorScheme.error) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                singleLine = true,
                enabled = !busy,
            )
            Button(onClick = onContinue, enabled = !busy && value.length == 10, modifier = Modifier.fillMaxWidth()) {
                Text(if (busy) "Continuing…" else "Continue")
            }
        }
    }
}
