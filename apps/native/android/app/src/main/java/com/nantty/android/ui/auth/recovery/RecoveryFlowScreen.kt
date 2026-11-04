package com.nantty.android.ui.auth.recovery

import com.nantty.android.data.AuthValidation

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff

/** The parent owns navigation and all recovery state; this composable only renders and reports intent. */
enum class RecoveryStep { Email, Code, NewPassword }

/**
 * Stateless recovery flow matching the React Native forgot-password, reset-purpose OTP, and
 * reset-password screens. The parent should advance [step] only after the corresponding request
 * succeeds, retain any verified OTP token outside this UI, and call the reset success continuation
 * only after the server confirms the password change.
 */
@Composable
fun RecoveryFlowScreen(
    step: RecoveryStep,
    email: String,
    code: String,
    newPassword: String,
    confirmPassword: String,
    errorsByStage: Map<RecoveryStep, String?> = emptyMap(),
    loadingByStage: Map<RecoveryStep, Boolean> = emptyMap(),
    resendSecondsRemaining: Int = 60,
    resendMessage: String? = null,
    onEmailChange: (String) -> Unit,
    onCodeChange: (String) -> Unit,
    onNewPasswordChange: (String) -> Unit,
    onConfirmPasswordChange: (String) -> Unit,
    onSendCode: (normalizedEmail: String) -> Unit,
    onVerifyCode: (sixDigitCode: String) -> Unit,
    onResendCode: () -> Unit,
    onResetPassword: (newPassword: String, onSuccess: () -> Unit) -> Unit,
    onComplete: () -> Unit,
    onBack: (() -> Unit)? = null,
) {
    val loading = loadingByStage[step] == true
    val error = errorsByStage[step]
    val focusManager = LocalFocusManager.current

    Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(
                Modifier.widthIn(max = RecoveryContentMaxWidth).fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    if (onBack != null) {
                        TextButton(onClick = onBack, enabled = !loading) { Text("Back") }
                    } else {
                        Spacer(Modifier.height(1.dp))
                    }
                    Spacer(Modifier.weight(1f))
                    Text("nantty", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.ExtraBold)
                    Spacer(Modifier.weight(1f))
                    if (onBack == null) Spacer(Modifier.widthIn(min = 48.dp))
                }

                when (step) {
                    RecoveryStep.Email -> EmailStep(
                        email = email,
                        loading = loading,
                        error = error,
                        onEmailChange = onEmailChange,
                        onSendCode = { onSendCode(email.trim().lowercase()) },
                        onIme = { if (AuthValidation.isValidEmail(email) && !loading) onSendCode(email.trim().lowercase()) },
                    )
                    RecoveryStep.Code -> CodeStep(
                        email = email,
                        code = code,
                        loading = loading,
                        error = error,
                        resendMessage = resendMessage,
                        resendSecondsRemaining = resendSecondsRemaining,
                        onCodeChange = { onCodeChange(it.filter { character -> character in '0'..'9' }.take(RecoveryCodeLength)) },
                        onVerifyCode = { onVerifyCode(code.filter { character -> character in '0'..'9' }) },
                        onResendCode = onResendCode,
                    )
                    RecoveryStep.NewPassword -> NewPasswordStep(
                        newPassword = newPassword,
                        confirmPassword = confirmPassword,
                        loading = loading,
                        error = error,
                        onNewPasswordChange = onNewPasswordChange,
                        onConfirmPasswordChange = onConfirmPasswordChange,
                        onResetPassword = {
                            focusManager.clearFocus()
                            onResetPassword(newPassword) { onComplete() }
                        },
                        onNextField = { focusManager.moveFocus(FocusDirection.Next) },
                        onDone = { if (isRecoveryPasswordValid(newPassword) && newPassword == confirmPassword && !loading) {
                            focusManager.clearFocus()
                            onResetPassword(newPassword) { onComplete() }
                        } },
                    )
                }
            }
        }
    }
}

private val RecoveryContentMaxWidth = 480.dp
private const val RecoveryCodeLength = AuthValidation.OTP_CODE_LENGTH

@Composable
private fun EmailStep(
    email: String,
    loading: Boolean,
    error: String?,
    onEmailChange: (String) -> Unit,
    onSendCode: () -> Unit,
    onIme: () -> Unit,
) {
    val validEmail = AuthValidation.isValidEmail(email)
    val focusManager = LocalFocusManager.current
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        RecoveryHeading(
            title = "Forgot password?",
            subtitle = "Enter the email on your account and we’ll send you a code to reset your password.",
        )
        OutlinedTextField(
            value = email,
            onValueChange = onEmailChange,
            modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Email" },
            label = { Text("Email") },
            placeholder = { Text("Enter your email") },
            singleLine = true,
            enabled = !loading,
            isError = error != null,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, capitalization = KeyboardCapitalization.None, autoCorrectEnabled = false, imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = { if (validEmail && !loading) { focusManager.clearFocus(); onIme() } }),
        )
        RecoveryServerError(error)
        RecoveryActionButton(label = "Send Code", loading = loading, enabled = validEmail, onClick = onSendCode)
    }
}

@Composable
private fun CodeStep(
    email: String,
    code: String,
    loading: Boolean,
    error: String?,
    resendMessage: String?,
    resendSecondsRemaining: Int,
    onCodeChange: (String) -> Unit,
    onVerifyCode: () -> Unit,
    onResendCode: () -> Unit,
) {
    val focusManager = LocalFocusManager.current
    val validCode = AuthValidation.isValidOtp(code)
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        RecoveryHeading("Enter 6-digit code", "Your code was sent to $email")
        RecoveryOtpField(
            code = code,
            enabled = !loading,
            isError = error != null,
            onCodeChange = onCodeChange,
            onDone = { if (validCode && !loading) { focusManager.clearFocus(); onVerifyCode() } },
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (resendSecondsRemaining > 0) {
                Text("Resend code", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                Text("  ${resendSecondsRemaining}s", style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
            } else {
                TextButton(onClick = onResendCode, enabled = !loading) { Text("Resend code") }
            }
        }
        RecoveryServerError(error)
        if (resendMessage != null) RecoveryStatusMessage(resendMessage)
        RecoveryActionButton(label = "Next", loading = loading, enabled = validCode, onClick = onVerifyCode)
    }
}

@Composable
private fun RecoveryOtpField(
    code: String,
    enabled: Boolean,
    isError: Boolean,
    onCodeChange: (String) -> Unit,
    onDone: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    BasicTextField(
        value = code,
        onValueChange = { onCodeChange(it.filter { character -> character in '0'..'9' }.take(RecoveryCodeLength)) },
        enabled = enabled,
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Done, autoCorrectEnabled = false),
        keyboardActions = KeyboardActions(onDone = { onDone() }),
        textStyle = MaterialTheme.typography.bodyLarge.copy(color = Color.Transparent),
        cursorBrush = SolidColor(Color.Transparent),
        modifier = Modifier.fillMaxWidth().semantics {
            contentDescription = "Verification code, ${code.length} of $RecoveryCodeLength digits entered"
        },
        decorationBox = { inner ->
            Box {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    repeat(RecoveryCodeLength) { index ->
                        val borderColor = if (isError) colors.error else colors.outline
                        Box(
                            Modifier.weight(1f).height(54.dp).border(BorderStroke(1.dp, borderColor), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(code.getOrNull(index)?.toString().orEmpty(), style = MaterialTheme.typography.titleMedium)
                        }
                    }
                }
                Box(Modifier.fillMaxSize().background(colors.background.copy(alpha = 0.01f))) { inner() }
            }
        },
    )
    Text("Verification code", modifier = Modifier.semantics { contentDescription = "Enter the 6-digit verification code" }, style = MaterialTheme.typography.labelMedium, color = colors.onSurfaceVariant)
}

@Composable
private fun NewPasswordStep(
    newPassword: String,
    confirmPassword: String,
    loading: Boolean,
    error: String?,
    onNewPasswordChange: (String) -> Unit,
    onConfirmPasswordChange: (String) -> Unit,
    onResetPassword: () -> Unit,
    onNextField: () -> Unit,
    onDone: () -> Unit,
) {
    var newPasswordVisible by remember { mutableStateOf(false) }
    var confirmPasswordVisible by remember { mutableStateOf(false) }
    val passwordsMatch = confirmPassword.isNotEmpty() && newPassword == confirmPassword
    val mismatch = confirmPassword.isNotEmpty() && !passwordsMatch
    val passwordValid = isRecoveryPasswordValid(newPassword)
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        RecoveryHeading("Create new password", "Your new password must be different from the one you used before.")
        OutlinedTextField(
            value = newPassword,
            onValueChange = { onNewPasswordChange(it.take(AuthValidation.MAXIMUM_PASSWORD_LENGTH)) },
            modifier = Modifier.fillMaxWidth().semantics { contentDescription = "New password" },
            label = { Text("New password") },
            placeholder = { Text("Enter password") },
            singleLine = true,
            enabled = !loading,
            visualTransformation = if (newPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, capitalization = KeyboardCapitalization.None, autoCorrectEnabled = false, imeAction = ImeAction.Next),
            keyboardActions = KeyboardActions(onNext = { onNextField() }),
            trailingIcon = {
                IconButton(onClick = { newPasswordVisible = !newPasswordVisible }, enabled = !loading) {
                    Icon(if (newPasswordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility, if (newPasswordVisible) "Hide new password" else "Show new password")
                }
            },
        )
        OutlinedTextField(
            value = confirmPassword,
            onValueChange = { onConfirmPasswordChange(it.take(AuthValidation.MAXIMUM_PASSWORD_LENGTH)) },
            modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Confirm password" },
            label = { Text("Confirm password") },
            placeholder = { Text("Enter password again") },
            singleLine = true,
            enabled = !loading,
            isError = mismatch,
            visualTransformation = if (confirmPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, capitalization = KeyboardCapitalization.None, autoCorrectEnabled = false, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { onDone() }),
            trailingIcon = {
                IconButton(onClick = { confirmPasswordVisible = !confirmPasswordVisible }, enabled = !loading) {
                    Icon(if (confirmPasswordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility, if (confirmPasswordVisible) "Hide confirm password" else "Show confirm password")
                }
            },
        )
        if (mismatch) RecoveryInlineError("Passwords don’t match.")
        PasswordPolicy(password = newPassword)
        RecoveryServerError(error)
        RecoveryActionButton(label = "Save password", loading = loading, enabled = passwordValid && passwordsMatch, onClick = onResetPassword)
    }
}

@Composable
private fun PasswordPolicy(password: String) {
    val hasLength = password.length in AuthValidation.MINIMUM_PASSWORD_LENGTH..AuthValidation.MAXIMUM_PASSWORD_LENGTH
    val hasLetterAndNumber = password.any(Char::isLetter) && password.any(Char::isDigit)
    val hasSpecial = password.any { !it.isLetterOrDigit() && !it.isWhitespace() }
    val metCount = listOf(hasLength, hasLetterAndNumber, hasSpecial).count { it }
    val strength = when {
        password.isEmpty() -> ""
        metCount == 3 -> "Strong"
        metCount == 2 -> "Medium"
        else -> "Weak"
    }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("Your password must have at least:", style = MaterialTheme.typography.bodyMedium)
        PasswordRule("${AuthValidation.MINIMUM_PASSWORD_LENGTH} characters (${AuthValidation.MAXIMUM_PASSWORD_LENGTH} max)", hasLength)
        PasswordRule("1 letter and 1 number", hasLetterAndNumber)
        PasswordRule("1 special character (Example: # ${'$'} % ! @)", hasSpecial)
        Spacer(Modifier.height(8.dp))
        Text("Password strength: ${strength.ifEmpty { "Not set" }}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun PasswordRule(label: String, met: Boolean) {
    val color = if (met) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
    Text("${if (met) "✓" else "○"}  $label", color = color, style = MaterialTheme.typography.bodySmall)
}

@Composable
private fun RecoveryHeading(title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
private fun RecoveryActionButton(label: String, loading: Boolean, enabled: Boolean, onClick: () -> Unit) {
    Button(onClick = onClick, enabled = enabled && !loading, modifier = Modifier.fillMaxWidth().height(54.dp)) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(20.dp).padding(end = 4.dp), strokeWidth = 2.dp)
            Text("Working…")
        } else Text(label)
    }
}

@Composable
private fun RecoveryServerError(message: String?) {
    if (message != null) RecoveryInlineError(message)
}

@Composable
private fun RecoveryInlineError(message: String) {
    Text(
        message,
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodySmall,
        modifier = Modifier.fillMaxWidth().semantics {
            liveRegion = LiveRegionMode.Polite
            contentDescription = "Error: $message"
        },
    )
}

@Composable
private fun RecoveryStatusMessage(message: String) {
    Text(
        message,
        color = MaterialTheme.colorScheme.primary,
        style = MaterialTheme.typography.bodySmall,
        modifier = Modifier.fillMaxWidth().semantics {
            liveRegion = LiveRegionMode.Polite
            contentDescription = message
        },
    )
}

private fun isRecoveryPasswordValid(value: String): Boolean = AuthValidation.meetsPasswordPolicy(value)
