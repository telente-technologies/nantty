package com.nantty.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp

@Composable
internal fun SignInScreen(
    loading: Boolean,
    error: String?,
    onSignIn: (identifier: String, password: String) -> Unit,
    onRetryRestore: (() -> Unit)? = null,
    onCreateAccount: (() -> Unit)? = null,
    onForgotPassword: (() -> Unit)? = null,
    onBrowseAsGuest: (() -> Unit)? = null,
    onGoogleSignIn: (() -> Unit)? = null,
) {
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    val canSubmit = identifier.isNotBlank() && password.isNotEmpty() && !loading

    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Box(Modifier.fillMaxSize().imePadding(), contentAlignment = Alignment.Center) {
            Column(
                Modifier.widthIn(max = 460.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 28.dp),
                verticalArrangement = Arrangement.Center,
            ) {
                Text("nantty", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold)
                Spacer(Modifier.height(28.dp))
                Text("Welcome back", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Text("Sign in to continue to your people and conversations.", color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.bodyLarge)
                Spacer(Modifier.height(28.dp))
                OutlinedTextField(
                    value = identifier,
                    onValueChange = { identifier = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Email or username") },
                    singleLine = true,
                    enabled = !loading,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text, imeAction = ImeAction.Next, autoCorrectEnabled = false),
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Password") },
                    singleLine = true,
                    enabled = !loading,
                    visualTransformation = if (passwordVisible || password.isEmpty()) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done, autoCorrectEnabled = false),
                    keyboardActions = KeyboardActions(onDone = { if (canSubmit) onSignIn(identifier.trim(), password) }),
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }, enabled = !loading) {
                            Icon(
                                imageVector = if (passwordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = if (passwordVisible) "Hide password" else "Show password",
                            )
                        }
                    },
                )
                onForgotPassword?.let { recover ->
                    TextButton(onClick = recover, enabled = !loading, modifier = Modifier.align(Alignment.End)) {
                        Text("Forgot password?")
                    }
                }
                if (error != null) {
                    Spacer(Modifier.height(16.dp))
                    Text(
                        error,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.fillMaxWidth().semantics {
                            liveRegion = LiveRegionMode.Polite
                            contentDescription = "Sign-in error: $error"
                        },
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    onRetryRestore?.let { retry -> TextButton(onClick = retry, enabled = !loading) { Text("Try again") } }
                }
                Spacer(Modifier.height(22.dp))
                Button(onClick = { onSignIn(identifier.trim(), password) }, enabled = canSubmit, modifier = Modifier.fillMaxWidth().height(54.dp)) {
                    if (loading) CircularProgressIndicator(Modifier.padding(end = 12.dp), strokeWidth = 2.dp)
                    Text(if (loading) "Signing in…" else "Sign in")
                }
                onGoogleSignIn?.let { continueWithGoogle ->
                    Spacer(Modifier.height(10.dp))
                    androidx.compose.material3.OutlinedButton(
                        onClick = continueWithGoogle,
                        enabled = !loading,
                        modifier = Modifier.fillMaxWidth().heightIn(min = 54.dp),
                    ) {
                        Text(if (loading) "Connecting to Google…" else "Continue with Google")
                    }
                }
                Spacer(Modifier.height(24.dp))
                RowLockNotice()
                onCreateAccount?.let { createAccount ->
                    Spacer(Modifier.height(10.dp))
                    TextButton(onClick = createAccount, enabled = !loading, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                        Text("New to Nantty? Create account")
                    }
                }
                onBrowseAsGuest?.let { browse ->
                    TextButton(onClick = browse, enabled = !loading, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                        Text("Browse as guest")
                    }
                }
            }
        }
    }
}

@Composable
private fun RowLockNotice() {
    androidx.compose.foundation.layout.Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.Lock, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
        Text("Your session is encrypted on this device", Modifier.padding(start = 8.dp), color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.bodySmall)
    }
}
