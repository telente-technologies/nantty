package com.nantty.android.ui.auth.recovery

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import com.nantty.android.data.AuthFlowApi
import com.nantty.android.data.AuthValidation
import java.util.concurrent.Executor

/** Owns ephemeral recovery state and connects the callback-driven UI to Nantty's auth API. */
@Composable
internal fun RecoveryAuthFlow(
    api: AuthFlowApi,
    executor: Executor,
    onBackToSignIn: () -> Unit,
) {
    var step by remember { mutableStateOf(RecoveryStep.Email) }
    var email by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var verifiedToken by remember { mutableStateOf<String?>(null) }
    var secondsRemaining by remember { mutableStateOf(0) }
    var resendMessage by remember { mutableStateOf<String?>(null) }
    val errors = remember { mutableStateMapOf<RecoveryStep, String?>() }
    val loading = remember { mutableStateMapOf<RecoveryStep, Boolean>() }

    LaunchedEffect(secondsRemaining) {
        if (secondsRemaining > 0) {
            kotlinx.coroutines.delay(1_000)
            secondsRemaining -= 1
        }
    }

    fun run(stage: RecoveryStep, onSuccess: () -> Unit, request: () -> Unit) {
        if (loading[stage] == true) return
        errors[stage] = null
        loading[stage] = true
        executor.execute {
            try {
                request()
                Snapshot.withMutableSnapshot {
                    loading[stage] = false
                    onSuccess()
                }
            } catch (failure: Exception) {
                Snapshot.withMutableSnapshot {
                    errors[stage] = failure.message ?: "We couldn't complete that step. Please try again."
                    loading[stage] = false
                }
            }
        }
    }

    RecoveryFlowScreen(
        step = step,
        email = email,
        code = code,
        newPassword = newPassword,
        confirmPassword = confirmPassword,
        errorsByStage = errors,
        loadingByStage = loading,
        resendSecondsRemaining = secondsRemaining,
        resendMessage = resendMessage,
        onEmailChange = { email = it; errors.remove(RecoveryStep.Email) },
        onCodeChange = { code = it; errors.remove(RecoveryStep.Code) },
        onNewPasswordChange = { newPassword = it; errors.remove(RecoveryStep.NewPassword) },
        onConfirmPasswordChange = { confirmPassword = it },
        onSendCode = { normalizedEmail ->
            email = normalizedEmail
            resendMessage = null
            run(RecoveryStep.Email, {
                step = RecoveryStep.Code
                code = ""
                secondsRemaining = AuthValidation.OTP_RESEND_COOLDOWN_SECONDS
            }) { api.sendOtp(normalizedEmail, "reset") }
        },
        onVerifyCode = { enteredCode ->
            var verified: String? = null
            run(RecoveryStep.Code, {
                code = enteredCode
                verifiedToken = verified
                step = RecoveryStep.NewPassword
            }) { verified = api.verifyOtp(email, enteredCode, "reset") }
        },
        onResendCode = {
            if (secondsRemaining == 0 && loading[RecoveryStep.Code] != true) {
                resendMessage = null
                executor.execute {
                    try {
                        api.sendOtp(email, "reset")
                        Snapshot.withMutableSnapshot {
                            secondsRemaining = AuthValidation.OTP_RESEND_COOLDOWN_SECONDS
                            resendMessage = "We sent you a new code."
                        }
                    } catch (failure: Exception) {
                        Snapshot.withMutableSnapshot {
                            resendMessage = failure.message ?: "We couldn't resend the code. Please try again."
                        }
                    }
                }
            }
        },
        onResetPassword = { password, afterSuccess ->
            val token = verifiedToken
            if (token == null) {
                errors[RecoveryStep.NewPassword] = "Your verification expired. Request a new code."
            } else {
                run(RecoveryStep.NewPassword, {
                    verifiedToken = null
                    code = ""
                    newPassword = ""
                    confirmPassword = ""
                    afterSuccess()
                }) { api.resetPassword(token, password) }
            }
        },
        onComplete = onBackToSignIn,
        onBack = {
            when (step) {
                RecoveryStep.Email -> onBackToSignIn()
                RecoveryStep.Code -> { step = RecoveryStep.Email; code = ""; verifiedToken = null }
                RecoveryStep.NewPassword -> {
                    // The verified token is single-use; return to email entry instead of offering
                    // the old OTP again after invalidating that token.
                    step = RecoveryStep.Email
                    code = ""
                    verifiedToken = null
                    newPassword = ""
                    confirmPassword = ""
                    secondsRemaining = 0
                }
            }
        },
    )
}

