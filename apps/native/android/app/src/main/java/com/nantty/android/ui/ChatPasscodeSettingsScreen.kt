package com.nantty.android.ui

import android.content.Context
import android.content.ContextWrapper
import androidx.activity.compose.BackHandler
import androidx.biometric.BiometricManager
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.nantty.android.data.CHAT_AUTO_LOCK_OPTIONS_SECONDS
import com.nantty.android.data.ChatLockPreferences
import com.nantty.android.data.ChatPasscodeRepository
import com.nantty.android.data.ChatPasscodeResult
import com.nantty.android.data.ChatPasscodeSnapshot
import com.nantty.android.data.isValidChatPasscode
import androidx.fragment.app.FragmentActivity
import java.util.concurrent.Executor
import java.util.concurrent.Executors

private enum class ChatPasscodeMode { OVERVIEW, SET, CHANGE, REMOVE }
private val DEFAULT_CHAT_PASSCODE_EXECUTOR: Executor by lazy {
    Executors.newSingleThreadExecutor { command -> Thread(command, "chat-passcode-settings").apply { isDaemon = true } }
}

@Composable
internal fun ChatPasscodeSettingsScreen(
    repository: ChatPasscodeRepository,
    executor: Executor = DEFAULT_CHAT_PASSCODE_EXECUTOR,
    onBack: () -> Unit,
    onPasscodeUpdated: () -> Unit = {},
    modifier: Modifier = Modifier,
    biometricAvailabilityOverride: Boolean? = null,
) {
    val context = LocalContext.current
    val hostActivity = remember(context) { context.findFragmentActivity() }
    val biometricAvailable = remember(hostActivity, biometricAvailabilityOverride) {
        biometricAvailabilityOverride ?: (hostActivity != null &&
            BiometricManager.from(hostActivity).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) ==
            BiometricManager.BIOMETRIC_SUCCESS)
    }
    var snapshot by remember(repository) { mutableStateOf<ChatPasscodeSnapshot?>(null) }
    var loading by remember(repository) { mutableStateOf(true) }
    var saving by remember(repository) { mutableStateOf(false) }
    var mode by remember(repository) { mutableStateOf(ChatPasscodeMode.OVERVIEW) }
    var currentPasscode by remember(repository) { mutableStateOf("") }
    var newPasscode by remember(repository) { mutableStateOf("") }
    var confirmPasscode by remember(repository) { mutableStateOf("") }
    var error by remember(repository) { mutableStateOf<String?>(null) }
    var reload by remember(repository) { mutableIntStateOf(0) }

    fun clearForm() {
        currentPasscode = ""
        newPasscode = ""
        confirmPasscode = ""
        error = null
    }

    fun returnToOverview() {
        mode = ChatPasscodeMode.OVERVIEW
        clearForm()
    }

    fun runOperation(operation: () -> ChatPasscodeResult<*>, onSuccess: () -> Unit) {
        if (saving) return
        saving = true
        error = null
        executor.execute {
            val result = operation()
            Snapshot.withMutableSnapshot {
                when (result) {
                    is ChatPasscodeResult.Success<*> -> onSuccess()
                    is ChatPasscodeResult.Failure -> error = result.message
                }
                saving = false
            }
        }
    }

    fun refreshSnapshot() {
        loading = true
        executor.execute {
            val result = repository.load()
            Snapshot.withMutableSnapshot {
                when (result) {
                    is ChatPasscodeResult.Success -> snapshot = result.value
                    is ChatPasscodeResult.Failure -> error = result.message
                }
                loading = false
            }
        }
    }

    fun submitPasscodeForm() {
        if (mode != ChatPasscodeMode.SET && !isValidChatPasscode(currentPasscode)) {
            error = "Enter your current 4 to 6 digit passcode."
            return
        }
        if (mode != ChatPasscodeMode.REMOVE) {
            if (!isValidChatPasscode(newPasscode)) {
                error = "Use a passcode with 4 to 6 digits."
                return
            }
            if (newPasscode != confirmPasscode) {
                error = "The passcodes don't match."
                return
            }
        }
        if (saving) return
        saving = true
        error = null
        val submittedMode = mode
        executor.execute {
            val result: ChatPasscodeResult<*> = if (submittedMode == ChatPasscodeMode.SET) {
                repository.setPasscode(newPasscode)
            } else {
                when (val verification = repository.verifyPasscode(currentPasscode)) {
                    is ChatPasscodeResult.Failure -> verification
                    is ChatPasscodeResult.Success -> when {
                        !verification.value -> ChatPasscodeResult.Failure("Your current passcode is wrong.")
                        submittedMode == ChatPasscodeMode.REMOVE -> repository.removePasscode()
                        else -> repository.setPasscode(newPasscode)
                    }
                }
            }
            Snapshot.withMutableSnapshot {
                when (result) {
                    is ChatPasscodeResult.Failure -> error = result.message
                    is ChatPasscodeResult.Success<*> -> {
                        snapshot = if (submittedMode == ChatPasscodeMode.REMOVE) {
                            ChatPasscodeSnapshot(false, ChatLockPreferences())
                        } else {
                            ChatPasscodeSnapshot(true, snapshot?.preferences ?: ChatLockPreferences())
                        }
                        onPasscodeUpdated()
                        returnToOverview()
                    }
                }
                saving = false
            }
        }
    }

    LaunchedEffect(repository, reload) { refreshSnapshot() }
    BackHandler(enabled = mode != ChatPasscodeMode.OVERVIEW, onBack = ::returnToOverview)
    BackHandler(enabled = mode == ChatPasscodeMode.OVERVIEW, onBack = onBack)

    val title = when (mode) {
        ChatPasscodeMode.OVERVIEW -> "Chat passcode"
        ChatPasscodeMode.SET -> "Set passcode"
        ChatPasscodeMode.CHANGE -> "Change passcode"
        ChatPasscodeMode.REMOVE -> "Remove passcode"
    }

    Column(modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(
                onClick = { if (mode == ChatPasscodeMode.OVERVIEW) onBack() else returnToOverview() },
                modifier = Modifier.semantics { contentDescription = "Back from $title" },
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
            Text(title, Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }
        HorizontalDivider()

        when {
            loading && snapshot == null -> Column(
                Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                CircularProgressIndicator(Modifier.semantics { contentDescription = "Loading chat passcode settings" })
            }
            snapshot == null -> Column(
                Modifier.fillMaxSize().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
            ) {
                Text(error ?: "Couldn't load chat passcode settings.", color = MaterialTheme.colorScheme.error)
                TextButton(onClick = { error = null; reload++ }) { Text("Try again") }
            }
            mode != ChatPasscodeMode.OVERVIEW -> PasscodeEntryForm(
                mode = mode,
                currentPasscode = currentPasscode,
                newPasscode = newPasscode,
                confirmPasscode = confirmPasscode,
                error = error,
                saving = saving,
                onCurrentChange = { currentPasscode = it.digitsOnlyPasscode() },
                onNewChange = { newPasscode = it.digitsOnlyPasscode() },
                onConfirmChange = { confirmPasscode = it.digitsOnlyPasscode() },
                onSubmit = ::submitPasscodeForm,
                onCancel = ::returnToOverview,
            )
            else -> PasscodeOverview(
                snapshot = snapshot!!,
                saving = saving,
                error = error,
                onSet = { clearForm(); mode = ChatPasscodeMode.SET },
                onChange = { clearForm(); mode = ChatPasscodeMode.CHANGE },
                onRemove = { clearForm(); mode = ChatPasscodeMode.REMOVE },
                biometricAvailable = biometricAvailable,
                onBiometricsChange = { enabled ->
                    snapshot?.let { current ->
                        if (current.isPasscodeSet && biometricAvailable && !saving) {
                            runOperation(
                                operation = {
                                    repository.updatePreferences(current.preferences.copy(biometricsEnabled = enabled))
                                },
                                onSuccess = {
                                    snapshot = current.copy(preferences = current.preferences.copy(biometricsEnabled = enabled))
                                },
                            )
                        }
                    }
                },
                onAutoLockChange = { seconds ->
                    snapshot?.let { current ->
                        runOperation(
                            operation = { repository.updatePreferences(current.preferences.copy(autoLockSeconds = seconds)) },
                            onSuccess = { snapshot = current.copy(preferences = current.preferences.copy(autoLockSeconds = seconds)) },
                        )
                    }
                },
            )
        }
    }
}

@Composable
private fun PasscodeOverview(
    snapshot: ChatPasscodeSnapshot,
    saving: Boolean,
    error: String?,
    onSet: () -> Unit,
    onChange: () -> Unit,
    onRemove: () -> Unit,
    biometricAvailable: Boolean,
    onBiometricsChange: (Boolean) -> Unit,
    onAutoLockChange: (Int) -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val contentWidth = maxWidth.coerceAtMost(640.dp)
        val contentWidthFraction = if (maxWidth > 640.dp) contentWidth / maxWidth else 1f
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Column(
                Modifier.align(Alignment.CenterHorizontally).fillMaxWidth(contentWidthFraction),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(
                    "The passcode locks your chats on this device only. It is never sent to Nantty. If you forget it, you'll need to log in again to reset it.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                if (snapshot.isPasscodeSet) {
                    TextButton(onClick = onChange, enabled = !saving, modifier = Modifier.fillMaxWidth()) { Text("Change passcode") }
                    TextButton(onClick = onRemove, enabled = !saving, modifier = Modifier.fillMaxWidth()) {
                        Text("Remove passcode", color = MaterialTheme.colorScheme.error)
                    }
                } else {
                    Button(onClick = onSet, enabled = !saving, modifier = Modifier.fillMaxWidth()) { Text("Set a passcode") }
                }

                HorizontalDivider()
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f).padding(end = 16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Unlock with biometrics", style = MaterialTheme.typography.bodyMedium)
                        Text(
                            when {
                                !biometricAvailable -> "Biometric unlock isn't available on this device."
                                !snapshot.isPasscodeSet -> "Set a chat passcode before enabling biometric unlock."
                                else -> "Use device biometrics to unlock chats."
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Switch(
                        checked = snapshot.preferences.biometricsEnabled,
                        onCheckedChange = onBiometricsChange,
                        enabled = biometricAvailable && snapshot.isPasscodeSet && !saving,
                        modifier = Modifier.semantics { contentDescription = "Unlock with biometrics" },
                    )
                }

                if (snapshot.isPasscodeSet) {
                    HorizontalDivider()
                    Text("Auto-lock", Modifier.semantics { heading() }, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    CHAT_AUTO_LOCK_OPTIONS_SECONDS.forEach { seconds ->
                        val label = describeAutoLockInterval(seconds)
                        Row(
                            Modifier.fillMaxWidth()
                                .selectable(
                                    selected = snapshot.preferences.autoLockSeconds == seconds,
                                    enabled = !saving,
                                    role = Role.RadioButton,
                                    onClick = { onAutoLockChange(seconds) },
                                )
                                .semantics { contentDescription = "Auto-lock: $label" }
                                .padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RadioButton(selected = snapshot.preferences.autoLockSeconds == seconds, onClick = null, enabled = !saving)
                            Text(label, Modifier.weight(1f).padding(start = 8.dp), style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }

                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            }
        }
    }
}

@Composable
private fun PasscodeEntryForm(
    mode: ChatPasscodeMode,
    currentPasscode: String,
    newPasscode: String,
    confirmPasscode: String,
    error: String?,
    saving: Boolean,
    onCurrentChange: (String) -> Unit,
    onNewChange: (String) -> Unit,
    onConfirmChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onCancel: () -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val contentWidth = maxWidth.coerceAtMost(480.dp)
        val contentWidthFraction = if (maxWidth > 480.dp) contentWidth / maxWidth else 1f
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Column(
                Modifier.align(Alignment.CenterHorizontally).fillMaxWidth(contentWidthFraction),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                if (mode != ChatPasscodeMode.SET) {
                    PasscodeField("Current passcode", currentPasscode, saving, onCurrentChange)
                }
                if (mode != ChatPasscodeMode.REMOVE) {
                    PasscodeField("New passcode (4 to 6 digits)", newPasscode, saving, onNewChange)
                    PasscodeField("Confirm passcode", confirmPasscode, saving, onConfirmChange)
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                Button(
                    onClick = onSubmit,
                    enabled = !saving,
                    modifier = Modifier.fillMaxWidth().semantics {
                        contentDescription = when (mode) {
                            ChatPasscodeMode.REMOVE -> "Remove passcode"
                            else -> "Save passcode"
                        }
                    },
                ) {
                    if (saving) CircularProgressIndicator()
                    else Text(if (mode == ChatPasscodeMode.REMOVE) "Remove passcode" else "Save passcode")
                }
                TextButton(onClick = onCancel, enabled = !saving, modifier = Modifier.fillMaxWidth()) { Text("Cancel") }
            }
        }
    }
}

@Composable
private fun PasscodeField(label: String, value: String, disabled: Boolean, onValueChange: (String) -> Unit) {
    OutlinedTextField(
        value = value,
        onValueChange = { input -> onValueChange(input.filter { it in '0'..'9' }.take(6)) },
        label = { Text(label) },
        enabled = !disabled,
        singleLine = true,
        visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        modifier = Modifier.fillMaxWidth().semantics { contentDescription = label },
    )
}

private fun describeAutoLockInterval(seconds: Int): String = when (seconds) {
    0 -> "Immediately"
    60 -> "After 1 min"
    300 -> "After 5 min"
    900 -> "After 15 min"
    3600 -> "After 1 hour"
    else -> "Unsupported interval"
}

private fun String.digitsOnlyPasscode(): String = filter { it in '0'..'9' }.take(6)

private fun Context.findFragmentActivity(): FragmentActivity? {
    var current: Context? = this
    while (current != null) {
        if (current is FragmentActivity) return current
        current = (current as? ContextWrapper)?.baseContext
    }
    return null
}
