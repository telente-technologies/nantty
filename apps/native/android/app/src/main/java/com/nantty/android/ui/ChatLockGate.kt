package com.nantty.android.ui

import android.content.Context
import android.content.ContextWrapper
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.nantty.android.data.ChatPasscodeRepository
import com.nantty.android.data.ChatPasscodeResult
import com.nantty.android.data.ChatPasscodeSnapshot
import com.nantty.android.data.isValidChatPasscode
import java.util.concurrent.Executor

@Composable
internal fun ChatLockGate(
    enabled: Boolean,
    isLoaded: Boolean,
    isLocked: Boolean,
    snapshot: ChatPasscodeSnapshot?,
    repository: ChatPasscodeRepository,
    executor: Executor,
    onUnlocked: () -> Unit,
    onForgotPasscode: () -> Unit,
    content: @Composable () -> Unit,
) {
    if (!enabled || !isLocked) {
        if (!enabled || isLoaded) content() else ChatLockLoading()
        return
    }
    if (!isLoaded) {
        ChatLockLoading()
        return
    }
    ChatUnlockScreen(repository, executor, snapshot?.preferences?.biometricsEnabled == true, onUnlocked, onForgotPasscode)
}

@Composable
private fun ChatLockLoading() {
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        CircularProgressIndicator()
        Spacer(Modifier.height(12.dp))
        Text("Checking chat lock…", style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun ChatUnlockScreen(
    repository: ChatPasscodeRepository,
    executor: Executor,
    biometricsEnabled: Boolean,
    onUnlocked: () -> Unit,
    onForgotPasscode: () -> Unit,
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findFragmentActivity() }
    val biometricAvailable = remember(activity) {
        activity != null && BiometricManager.from(activity).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS
    }
    var passcode by remember { mutableStateOf("") }
    var verifying by remember { mutableStateOf(false) }
    var wrongPasscode by remember { mutableStateOf(false) }
    var showForgotConfirmation by remember { mutableStateOf(false) }

    fun promptBiometric() {
        val host = activity ?: return
        if (!biometricAvailable) return
        val prompt = BiometricPrompt(
            host,
            ContextCompat.getMainExecutor(host),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    onUnlocked()
                }
            },
        )
        prompt.authenticate(
            BiometricPrompt.PromptInfo.Builder()
                .setTitle("Unlock your chats")
                .setSubtitle("Confirm your identity to continue")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                .setNegativeButtonText("Use passcode")
                .build(),
        )
    }

    LaunchedEffect(biometricsEnabled, biometricAvailable) {
        if (biometricsEnabled && biometricAvailable) promptBiometric()
    }

    Column(
        Modifier.fillMaxSize().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Column(
            Modifier.fillMaxWidth().widthIn(max = 420.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("Chats are locked", Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
            Text("Enter your 4 to 6 digit chat passcode to continue.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            OutlinedTextField(
                value = passcode,
                onValueChange = { input ->
                    passcode = input.filter(Char::isDigit).take(6)
                    wrongPasscode = false
                },
                label = { Text("Chat passcode") },
                singleLine = true,
                enabled = !verifying,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                isError = wrongPasscode,
                modifier = Modifier.fillMaxWidth(),
            )
            if (wrongPasscode) Text("Wrong passcode. Try again.", color = MaterialTheme.colorScheme.error)
            Button(
                onClick = {
                    verifying = true
                    executor.execute {
                        val result = repository.verifyPasscode(passcode)
                        androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                            verifying = false
                            when (result) {
                                is ChatPasscodeResult.Success -> if (result.value) onUnlocked() else wrongPasscode = true
                                is ChatPasscodeResult.Failure -> wrongPasscode = true
                            }
                        }
                    }
                },
                enabled = !verifying && isValidChatPasscode(passcode),
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (verifying) CircularProgressIndicator(Modifier.height(20.dp), strokeWidth = 2.dp)
                else Text("Unlock chats")
            }
            TextButton(onClick = { showForgotConfirmation = true }, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                Text("Forgot passcode? Sign out")
            }
            if (biometricsEnabled && biometricAvailable) {
                TextButton(onClick = ::promptBiometric, modifier = Modifier.align(Alignment.CenterHorizontally)) {
                    Text("Use biometrics")
                }
            }
        }
    }

    if (showForgotConfirmation) {
        AlertDialog(
            onDismissRequest = { showForgotConfirmation = false },
            title = { Text("Reset chat passcode?") },
            text = { Text("To reset a forgotten passcode, sign out of Nantty. Your passcode is stored only on this device.") },
            confirmButton = {
                TextButton(onClick = { showForgotConfirmation = false; onForgotPasscode() }) { Text("Sign out") }
            },
            dismissButton = { TextButton(onClick = { showForgotConfirmation = false }) { Text("Cancel") } },
        )
    }
}

private fun Context.findFragmentActivity(): FragmentActivity? {
    var current: Context? = this
    while (current != null) {
        if (current is FragmentActivity) return current
        current = (current as? ContextWrapper)?.baseContext
    }
    return null
}
