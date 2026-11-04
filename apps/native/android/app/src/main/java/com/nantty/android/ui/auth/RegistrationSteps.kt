package com.nantty.android.ui.auth

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.nantty.android.R
import com.nantty.android.data.AuthValidation

@Composable
internal fun WelcomeStep(state: RegistrationFlowState, callbacks: RegistrationFlowCallbacks) {
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            TextButton(onClick = callbacks.onBrowseAsGuest) { Text("Browse as guest") }
        }
        WelcomeArtwork()
        Column(verticalArrangement = Arrangement.spacedBy(8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("Discover real sellers around you", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            Text(
                "Shop real sellers, pay safely with escrow.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.height(2.dp))
        if (state.isAppleSignInAvailable) {
            OutlinedAuthButton(
                title = "Continue with Apple",
                loading = state.activeSocialProvider == "apple",
                enabled = state.activeSocialProvider == null,
                onClick = callbacks.onContinueWithApple,
            )
        }
        if (state.isGoogleSignInAvailable) {
            OutlinedAuthButton(
                title = "Continue with Google",
                loading = state.activeSocialProvider == "google",
                enabled = state.activeSocialProvider == null,
                onClick = callbacks.onContinueWithGoogle,
            )
        }
        state.socialSignInError?.let { message ->
            Text(
                message,
                modifier = Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        PrimaryAuthButton("Use email", enabled = state.activeSocialProvider == null, onClick = callbacks.onStartSignup)
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Already have an account? ", style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = callbacks.onLogin) { Text("Log in") }
        }
        Text(
            "By continuing, you agree to our Terms of Service and acknowledge you have read our Privacy Policy and Cookie Use to learn how we collect, use, and share your data.",
            modifier = Modifier.fillMaxWidth(),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun WelcomeArtwork() {
    Surface(
        modifier = Modifier.fillMaxWidth().heightIn(min = 190.dp),
        shape = MaterialTheme.shapes.extraLarge,
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Image(painterResource(R.drawable.ic_nantty), contentDescription = "Nantty", modifier = Modifier.size(64.dp))
                Text("Nantty", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
internal fun ContactStep(
    state: RegistrationFlowState,
    callbacks: RegistrationFlowCallbacks,
    email: String,
    onEmailChanged: (String) -> Unit,
) {
    val validEmail = AuthValidation.isValidEmail(email)
    AuthStepFrame(
        step = state.step,
        title = "What’s your email?",
        subtitle = "We’ll send you a 6-digit code to confirm it’s you.",
        actionTitle = "Send Code",
        enabled = validEmail && !state.isSendingCode,
        loading = state.isSendingCode,
        onAction = { callbacks.onSendCode(email.trim().lowercase()) },
        onBack = callbacks.onBack,
    ) {
        OutlinedTextField(
            value = email,
            onValueChange = onEmailChanged,
            modifier = Modifier.fillMaxWidth().semantics {
                if (state.emailError != null) error(state.emailError)
            },
            label = { Text("Email") },
            placeholder = { Text("Enter your email") },
            singleLine = true,
            isError = state.emailError != null,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            supportingText = { state.emailError?.let { InlineMessage(it, isError = true) } },
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            androidx.compose.material3.Checkbox(
                checked = state.saveLoginInfo,
                onCheckedChange = callbacks.onSaveLoginInfoChanged,
            )
            Text(
                "Save login info on your device to log in automatically next time.",
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
internal fun VerificationStep(
    state: RegistrationFlowState,
    callbacks: RegistrationFlowCallbacks,
    code: String,
    onCodeChanged: (String) -> Unit,
    onVerify: () -> Unit,
) {
    AuthStepFrame(
        step = state.step,
        title = "Enter 6-digit code",
        subtitle = "Your code was sent to ${state.destination}",
        actionTitle = "Next",
        enabled = AuthValidation.isValidOtp(code) && !state.isVerifyingCode,
        loading = state.isVerifyingCode,
        onAction = onVerify,
        onBack = callbacks.onBack,
    ) {
        OutlinedTextField(
            value = code,
            onValueChange = onCodeChanged,
            modifier = Modifier.fillMaxWidth().semantics {
                contentDescription = "Verification code, ${code.length} of 6 digits entered"
                state.verificationError?.let { error(it) }
            },
            label = { Text("6-digit code") },
            placeholder = { Text("Enter verification code") },
            singleLine = true,
            isError = state.verificationError != null,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { onVerify() }),
            supportingText = state.verificationError?.let { error -> ({ InlineMessage(error, isError = true) }) },
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (state.resendSecondsRemaining > 0 || state.isResendingCode) {
                Text(
                    if (state.isResendingCode) "Sending a new code…" else "Resend code in ${state.resendSecondsRemaining}s",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                TextButton(onClick = callbacks.onResendCode, enabled = !state.isResendingCode) {
                    Text("Resend code")
                }
            }
        }
        state.noticeMessage?.let { InlineMessage(it, isError = false) }
    }
}

@Composable
internal fun BirthdayStep(
    state: RegistrationFlowState,
    callbacks: RegistrationFlowCallbacks,
    birthdayInput: String,
    onBirthdayInputChanged: (String) -> Unit,
) {
    val isoDate = AuthValidation.validBirthdayIso(birthdayInput)
    val hasFullDate = birthdayInput.length == 10
    val localError = when {
        !hasFullDate || isoDate != null -> null
        else -> "Enter a valid date and make sure you’re at least ${AuthValidation.MINIMUM_ACCOUNT_AGE_YEARS} years old."
    }
    AuthStepFrame(
        step = state.step,
        title = "When’s your birthday?",
        subtitle = "Your birthday won’t be shown publicly.",
        actionTitle = "Next",
        enabled = isoDate != null,
        onAction = { isoDate?.let(callbacks.onBirthdayContinue) },
        onBack = callbacks.onBack,
    ) {
        OutlinedTextField(
            value = birthdayInput,
            onValueChange = { raw -> onBirthdayInputChanged(formatBirthdayInput(raw)) },
            modifier = Modifier.fillMaxWidth().semantics {
                localError?.let { error(it) }
                state.birthdayError?.let { error(it) }
            },
            label = { Text("Birthday") },
            placeholder = { Text("dd/mm/yyyy") },
            singleLine = true,
            isError = localError != null,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
            supportingText = { (localError ?: state.birthdayError)?.let { InlineMessage(it, isError = true) } },
        )
    }
}

@Composable
internal fun PasswordStep(
    state: RegistrationFlowState,
    callbacks: RegistrationFlowCallbacks,
    password: String,
    onPasswordChanged: (String) -> Unit,
) {
    var passwordVisible by remember { mutableStateOf(false) }
    val meetsPolicy = AuthValidation.meetsPasswordPolicy(password)
    AuthStepFrame(
        step = state.step,
        title = "Create password",
        subtitle = "Choose a strong password to protect your account.",
        actionTitle = "Next",
        enabled = meetsPolicy,
        onAction = { callbacks.onPasswordContinue(password) },
        onBack = callbacks.onBack,
    ) {
        OutlinedTextField(
            value = password,
            onValueChange = { onPasswordChanged(it.take(AuthValidation.MAXIMUM_PASSWORD_LENGTH)) },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Password") },
            placeholder = { Text("Enter password") },
            singleLine = true,
            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
            trailingIcon = {
                TextButton(onClick = { passwordVisible = !passwordVisible }) {
                    Text(if (passwordVisible) "Hide" else "Show")
                }
            },
        )
        PasswordPolicy(password)
    }
}

@Composable
private fun PasswordPolicy(password: String) {
    val lengthOk = password.length in AuthValidation.MINIMUM_PASSWORD_LENGTH..AuthValidation.MAXIMUM_PASSWORD_LENGTH
    val letterAndNumberOk = password.any(Char::isLetter) && password.any(Char::isDigit)
    val symbolOk = password.any { !it.isLetterOrDigit() && !it.isWhitespace() }
    val metCount = listOf(lengthOk, letterAndNumberOk, symbolOk).count { it }
    val strength = when {
        password.isEmpty() -> "not set"
        metCount == 3 -> "Strong"
        metCount == 2 -> "Medium"
        else -> "Weak"
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Your password must have at least:", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
        PasswordRule("8 characters (20 max)", lengthOk)
        PasswordRule("1 letter and 1 number", letterAndNumberOk)
        PasswordRule("1 special character (Example: # \\$ % ! @)", symbolOk)
        LinearProgressIndicator(
            progress = metCount / 3f,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp)
                .semantics {
                    contentDescription = "Password strength: $strength"
                    progressBarRangeInfo = androidx.compose.ui.semantics.ProgressBarRangeInfo(metCount / 3f, 0f..1f)
                },
        )
        Text("Password strength: $strength", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun PasswordRule(label: String, met: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(if (met) "✓" else "○", color = if (met) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = if (met) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
internal fun UsernameStep(
    state: RegistrationFlowState,
    callbacks: RegistrationFlowCallbacks,
    username: String,
    onUsernameChanged: (String) -> Unit,
) {
    val validUsername = AuthValidation.isValidUsername(username)
    val canUseUsername = validUsername && state.usernameAvailability == UsernameAvailability.Available
    AuthStepFrame(
        step = state.step,
        title = "Create username",
        subtitle = "We’ve suggested one for you. Keep it, change it, or skip — you’ll keep the suggested username and can change it later in Settings.",
        actionTitle = "Confirm",
        enabled = canUseUsername && !state.isCreatingAccount,
        loading = state.isCreatingAccount,
        onAction = { callbacks.onCreateAccount(username) },
        onBack = callbacks.onBack,
        topAction = {
            TextButton(
                onClick = { onUsernameChanged(state.suggestedUsername) },
                enabled = state.suggestedUsername.isNotBlank() && !state.isCreatingAccount,
            ) { Text("Use suggestion") }
        },
    ) {
        OutlinedTextField(
            value = username,
            onValueChange = { onUsernameChanged(it.filterNot(Char::isWhitespace).take(20)) },
            modifier = Modifier.fillMaxWidth().semantics {
                state.usernameError?.let { error(it) }
            },
            label = { Text("Username") },
            placeholder = { Text("Username") },
            singleLine = true,
            isError = state.usernameError != null || state.usernameAvailability == UsernameAvailability.Unavailable,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii, imeAction = ImeAction.Done),
            supportingText = {
                when {
                    state.usernameError != null -> InlineMessage(state.usernameError, isError = true)
                    state.usernameAvailability == UsernameAvailability.Checking -> Text("Checking availability…")
                    state.usernameAvailability == UsernameAvailability.Available -> InlineMessage(
                        state.usernameAvailabilityMessage ?: "Username is available.",
                        isError = false,
                    )
                    state.usernameAvailability == UsernameAvailability.Unavailable -> InlineMessage(
                        state.usernameAvailabilityMessage ?: "That username isn’t available. Try another one.",
                        isError = true,
                    )
                    else -> Text("3–20 characters. Letters, numbers, underscores and full stops only.")
                }
            },
        )
        if (state.usernameSuggestions.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Suggestions", style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    state.usernameSuggestions.take(3).forEach { suggestion ->
                        FilterChip(
                            selected = username == suggestion,
                            onClick = { onUsernameChanged(suggestion) },
                            label = { Text(suggestion) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
internal fun PersonalizationStep(
    state: RegistrationFlowState,
    callbacks: RegistrationFlowCallbacks,
    selectedTopicIds: Set<String>,
    onSelectionChanged: (Set<String>) -> Unit,
) {
    AuthStepFrame(
        step = state.step,
        title = "Personalize your feed",
        subtitle = if (state.isCustomizingFeed) "Customizing your feed…" else "Add or edit topics you follow. Choose three or more.",
        actionTitle = "Continue",
        enabled = selectedTopicIds.size >= AuthValidation.MINIMUM_PERSONALIZATION_TOPICS && !state.isSavingTopics,
        loading = state.isSavingTopics || state.isCustomizingFeed,
        onAction = { callbacks.onSaveTopics(selectedTopicIds) },
        onBack = callbacks.onBack,
        topAction = {
            TextButton(onClick = callbacks.onSkipTopics, enabled = !state.isSavingTopics && !state.isCustomizingFeed) {
                Text("Skip")
            }
        },
    ) {
        when {
            state.isLoadingTopics -> {
                Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(Modifier.size(28.dp))
                }
            }
            state.topicsError != null -> {
                InlineMessage(state.topicsError, isError = true)
                TextButton(onClick = callbacks.onTopicsLoad) { Text("Try again") }
            }
            state.topics.isEmpty() -> Text("Topics will appear here when available.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            else -> {
                Text("Choose topics", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    state.topics.forEach { topic ->
                        FilterChip(
                            selected = topic.id in selectedTopicIds,
                            onClick = {
                                val next = selectedTopicIds.toMutableSet().apply {
                                    if (!add(topic.id)) remove(topic.id)
                                }.toSet()
                                onSelectionChanged(next)
                                callbacks.onTopicSelectionChanged(next)
                            },
                            label = { Text(topic.name) },
                        )
                    }
                }
                Text(
                    "${selectedTopicIds.size} selected · choose at least ${AuthValidation.MINIMUM_PERSONALIZATION_TOPICS}",
                    modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

