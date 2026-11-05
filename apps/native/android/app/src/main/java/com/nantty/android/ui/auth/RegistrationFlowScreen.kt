package com.nantty.android.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.nantty.android.data.AuthValidation
import kotlinx.coroutines.delay

private const val SIGNUP_STEPS = 6
private const val USERNAME_CHECK_DEBOUNCE_MS = 350L

@Composable
fun RegistrationFlowScreen(
    state: RegistrationFlowState,
    callbacks: RegistrationFlowCallbacks,
    dismissibleWelcome: Boolean = false,
    modifier: Modifier = Modifier,
) {
    var email by rememberSaveable { mutableStateOf("") }
    var otp by remember { mutableStateOf("") }
    var birthdayInput by rememberSaveable { mutableStateOf("") }
    // Do not use rememberSaveable for a password; it should not be written to saved instance state.
    var password by remember { mutableStateOf("") }
    var username by rememberSaveable { mutableStateOf(state.suggestedUsername) }
    var selectedTopicIds by remember { mutableStateOf(emptySet<String>()) }
    var lastAutoSubmittedOtp by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(state.destination) {
        otp = ""
        lastAutoSubmittedOtp = null
    }
    LaunchedEffect(state.suggestedUsername) {
        if (username.isBlank() && state.suggestedUsername.isNotBlank()) username = state.suggestedUsername
    }
    LaunchedEffect(state.step) {
        if (state.step == RegistrationStep.Personalization) callbacks.onTopicsLoad()
    }

    val latestAvailabilityCallback by rememberUpdatedState(callbacks.onUsernameAvailability)
    LaunchedEffect(username) {
        if (state.step == RegistrationStep.Username && AuthValidation.isValidUsername(username)) {
            delay(USERNAME_CHECK_DEBOUNCE_MS)
            latestAvailabilityCallback(username)
        }
    }

    val verify = {
        val code = otp
        if (AuthValidation.isValidOtp(code) && !state.isVerifyingCode && lastAutoSubmittedOtp != code) {
            lastAutoSubmittedOtp = code
            callbacks.onVerifyCode(code)
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .imePadding(),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 520.dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = 16.dp),
        ) {
            when (state.step) {
                RegistrationStep.Welcome -> WelcomeStep(state, callbacks, dismissibleWelcome)
                RegistrationStep.Contact -> ContactStep(state, callbacks, email, { email = it })
                RegistrationStep.VerifyCode -> VerificationStep(
                    state = state,
                    callbacks = callbacks,
                    code = otp,
                    onCodeChanged = { next ->
                        otp = next.filter(Char::isDigit).take(6)
                        if (otp != lastAutoSubmittedOtp) lastAutoSubmittedOtp = null
                        if (AuthValidation.isValidOtp(otp)) verify()
                    },
                    onVerify = verify,
                )
                RegistrationStep.Birthday -> BirthdayStep(state, callbacks, birthdayInput, { birthdayInput = it })
                RegistrationStep.Password -> PasswordStep(state, callbacks, password, { password = it })
                RegistrationStep.Username -> UsernameStep(state, callbacks, username, { username = it })
                RegistrationStep.Personalization -> PersonalizationStep(
                    state = state,
                    callbacks = callbacks,
                    selectedTopicIds = selectedTopicIds,
                    onSelectionChanged = { selectedTopicIds = it },
                )
            }
        }
    }
}

@Composable
internal fun AuthStepFrame(
    step: RegistrationStep,
    title: String,
    subtitle: String,
    actionTitle: String,
    enabled: Boolean,
    loading: Boolean = false,
    onAction: () -> Unit,
    onBack: () -> Unit,
    topAction: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val progressStep = when (step) {
        RegistrationStep.Contact -> 1
        RegistrationStep.VerifyCode -> 2
        RegistrationStep.Birthday -> 3
        RegistrationStep.Password -> 4
        RegistrationStep.Username -> 5
        RegistrationStep.Personalization -> 6
        RegistrationStep.Welcome -> 0
    }
    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(onClick = onBack) { Text("‹  Back") }
            if (topAction != null) topAction()
            else if (progressStep > 0) Text("Step $progressStep of $SIGNUP_STEPS", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (progressStep > 0) {
            LinearProgressIndicator(
                progress = progressStep / SIGNUP_STEPS.toFloat(),
                modifier = Modifier.fillMaxWidth().semantics {
                    progressBarRangeInfo = androidx.compose.ui.semantics.ProgressBarRangeInfo(progressStep / SIGNUP_STEPS.toFloat(), 0f..1f)
                },
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
            Text(subtitle, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        content()
        Spacer(Modifier.height(8.dp))
        PrimaryAuthButton(
            title = actionTitle,
            enabled = enabled,
            loading = loading,
            onClick = onAction,
        )
        Spacer(Modifier.height(12.dp))
    }
}

@Composable
internal fun OutlinedAuthButton(title: String, loading: Boolean, enabled: Boolean, onClick: () -> Unit) {
    androidx.compose.material3.OutlinedButton(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().heightIn(min = 54.dp),
        enabled = enabled,
        shape = MaterialTheme.shapes.large,
    ) {
        if (loading) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
        else Text(title, fontWeight = FontWeight.Medium)
    }
}

@Composable
internal fun PrimaryAuthButton(
    title: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().heightIn(min = 54.dp),
        enabled = enabled && !loading,
        shape = MaterialTheme.shapes.large,
        colors = ButtonDefaults.buttonColors(),
    ) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
            Text("  Please wait…")
        } else Text(title, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
internal fun InlineMessage(message: String, isError: Boolean) {
    Text(
        message,
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        style = MaterialTheme.typography.bodySmall,
        color = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
    )
}

internal fun formatBirthdayInput(raw: String): String {
    val digits = raw.filter(Char::isDigit).take(8)
    return buildString {
        digits.forEachIndexed { index, digit ->
            if (index == 2 || index == 4) append('/')
            append(digit)
        }
    }
}
