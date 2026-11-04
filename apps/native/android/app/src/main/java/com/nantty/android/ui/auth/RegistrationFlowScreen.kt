package com.nantty.android.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.nantty.android.data.AuthValidation
import com.nantty.android.R
import kotlinx.coroutines.delay

/** Steps mirror the React Native registration journey. The shell owns step changes and async work. */
enum class RegistrationStep {
    Welcome,
    Contact,
    VerifyCode,
    Birthday,
    Password,
    Username,
    Personalization,
}

enum class UsernameAvailability {
    Idle,
    Checking,
    Available,
    Unavailable,
}

data class RegistrationTopic(val id: String, val name: String)

/**
 * State supplied by the shell. Form values (including passwords and OTPs) stay transient in
 * Compose; the shell only receives them through the action callbacks. Dates passed to
 * [RegistrationFlowCallbacks.onBirthdayContinue] are ISO-8601 (yyyy-MM-dd).
 */
data class RegistrationFlowState(
    val step: RegistrationStep = RegistrationStep.Contact,
    val destination: String = "",
    val emailError: String? = null,
    val verificationError: String? = null,
    val birthdayError: String? = null,
    val noticeMessage: String? = null,
    val isSendingCode: Boolean = false,
    val isVerifyingCode: Boolean = false,
    val isResendingCode: Boolean = false,
    val resendSecondsRemaining: Int = DEFAULT_RESEND_SECONDS,
    val saveLoginInfo: Boolean = false,
    val isAppleSignInAvailable: Boolean = false,
    val isGoogleSignInAvailable: Boolean = false,
    val activeSocialProvider: String? = null,
    val socialSignInError: String? = null,
    val isWelcomeDismissible: Boolean = false,
    val suggestedUsername: String = "",
    val usernameAvailability: UsernameAvailability = UsernameAvailability.Idle,
    val usernameAvailabilityMessage: String? = null,
    val usernameError: String? = null,
    val usernameSuggestions: List<String> = emptyList(),
    val isCreatingAccount: Boolean = false,
    val topics: List<RegistrationTopic> = emptyList(),
    val isLoadingTopics: Boolean = false,
    val topicsError: String? = null,
    val isSavingTopics: Boolean = false,
    val isCustomizingFeed: Boolean = false,
)

/**
 * Pure UI-to-shell boundary. Network calls, persistence, navigation, and session changes belong
 * to the parent. `onResendCode` should start/reset the shell-owned resend cooldown.
 */
data class RegistrationFlowCallbacks(
    val onStartSignup: () -> Unit,
    val onContinueWithApple: () -> Unit,
    val onContinueWithGoogle: () -> Unit,
    val onLogin: () -> Unit,
    val onWelcomeDismiss: () -> Unit,
    val onBrowseAsGuest: () -> Unit,
    val onBack: () -> Unit,
    val onSendCode: (email: String) -> Unit,
    val onSaveLoginInfoChanged: (enabled: Boolean) -> Unit,
    val onVerifyCode: (code: String) -> Unit,
    val onResendCode: () -> Unit,
    val onBirthdayContinue: (birthdayIso: String) -> Unit,
    val onPasswordContinue: (password: String) -> Unit,
    val onCreateAccount: (username: String) -> Unit,
    val onUsernameAvailability: (username: String) -> Unit,
    val onTopicsLoad: () -> Unit,
    val onSaveTopics: (topicIds: Set<String>) -> Unit,
    val onSkipTopics: () -> Unit,
    val onTopicSelectionChanged: (topicIds: Set<String>) -> Unit,
)

private const val DEFAULT_RESEND_SECONDS = AuthValidation.OTP_RESEND_COOLDOWN_SECONDS
private const val SIGNUP_STEPS = 6
private const val USERNAME_CHECK_DEBOUNCE_MS = 350L

@Composable
fun RegistrationFlowScreen(
    state: RegistrationFlowState,
    callbacks: RegistrationFlowCallbacks,
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
                RegistrationStep.Welcome -> WelcomeStep(state, callbacks)
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
private fun WelcomeStep(state: RegistrationFlowState, callbacks: RegistrationFlowCallbacks) {
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
private fun ContactStep(
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
private fun VerificationStep(
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
private fun BirthdayStep(
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
private fun PasswordStep(
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
private fun UsernameStep(
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
                onClick = { callbacks.onCreateAccount(state.suggestedUsername) },
                enabled = state.suggestedUsername.isNotBlank() && !state.isCreatingAccount,
            ) { Text("Skip") }
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
private fun PersonalizationStep(
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

@Composable
private fun AuthStepFrame(
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
private fun OutlinedAuthButton(title: String, loading: Boolean, enabled: Boolean, onClick: () -> Unit) {
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
private fun PrimaryAuthButton(
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
private fun InlineMessage(message: String, isError: Boolean) {
    Text(
        message,
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        style = MaterialTheme.typography.bodySmall,
        color = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
    )
}

private fun formatBirthdayInput(raw: String): String {
    val digits = raw.filter(Char::isDigit).take(8)
    return buildString {
        digits.forEachIndexed { index, digit ->
            if (index == 2 || index == 4) append('/')
            append(digit)
        }
    }
}
