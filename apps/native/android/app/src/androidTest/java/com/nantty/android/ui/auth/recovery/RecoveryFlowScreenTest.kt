package com.nantty.android.ui.auth.recovery

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RecoveryFlowScreenTest {
    @get:Rule val compose = createComposeRule()

    @Test
    fun emailStepValidatesAndSendsNormalizedAddress() {
        var email by mutableStateOf("")
        var sentEmail: String? = null
        compose.setContent {
            MaterialTheme {
                RecoveryFlowScreen(
                    step = RecoveryStep.Email,
                    email = email,
                    code = "",
                    newPassword = "",
                    confirmPassword = "",
                    onEmailChange = { email = it }, onCodeChange = {}, onNewPasswordChange = {}, onConfirmPasswordChange = {},
                    onSendCode = { sentEmail = it }, onVerifyCode = {}, onResendCode = {},
                    onResetPassword = { _, _ -> }, onComplete = {},
                )
            }
        }

        compose.onNodeWithText("Forgot password?").assertIsDisplayed()
        compose.onNodeWithText("Send Code").assertIsNotEnabled()
        compose.onNodeWithText("Enter your email").performTextInput("  Ari.Example@Mail.COM ")
        compose.onNodeWithText("Send Code").assertIsEnabled().performClick()
        compose.runOnIdle { assertEquals("ari.example@mail.com", sentEmail) }
    }

    @Test
    fun codeStepRestrictsToSixDigitsAndExposesResendAndVerifyCallbacks() {
        var code by mutableStateOf("")
        var verified: String? = null
        var resendCount = 0
        compose.setContent {
            MaterialTheme {
                RecoveryFlowScreen(
                    step = RecoveryStep.Code,
                    email = "ari@example.com",
                    code = code,
                    newPassword = "",
                    confirmPassword = "",
                    resendSecondsRemaining = 0,
                    onEmailChange = {}, onCodeChange = { code = it }, onNewPasswordChange = {}, onConfirmPasswordChange = {},
                    onSendCode = {}, onVerifyCode = { verified = it }, onResendCode = { resendCount += 1 },
                    onResetPassword = { _, _ -> }, onComplete = {},
                )
            }
        }

        compose.onNodeWithText("Enter 6-digit code").assertIsDisplayed()
        compose.onNodeWithText("Your code was sent to ari@example.com").assertIsDisplayed()
        compose.onNodeWithText("Next").assertIsNotEnabled()
        compose.onNodeWithContentDescription("Verification code, 0 of 6 digits entered").performTextInput("12a34567")
        compose.onNodeWithText("Next").assertIsEnabled().performClick()
        compose.onNodeWithText("Resend code").performClick()
        compose.runOnIdle {
            assertEquals("123456", code)
            assertEquals("123456", verified)
            assertEquals(1, resendCount)
        }
    }

    @Test
    fun codeStepShowsParentProvidedLoadingErrorAndResendStatus() {
        compose.setContent {
            MaterialTheme {
                RecoveryFlowScreen(
                    step = RecoveryStep.Code,
                    email = "ari@example.com",
                    code = "123456",
                    newPassword = "",
                    confirmPassword = "",
                    errorsByStage = mapOf(RecoveryStep.Code to "That code didn't work. Try again."),
                    loadingByStage = mapOf(RecoveryStep.Code to true),
                    resendMessage = "We couldn't resend the code. Please try again.",
                    onEmailChange = {}, onCodeChange = {}, onNewPasswordChange = {}, onConfirmPasswordChange = {},
                    onSendCode = {}, onVerifyCode = {}, onResendCode = {}, onResetPassword = { _, _ -> }, onComplete = {},
                )
            }
        }

        compose.onNodeWithText("That code didn't work. Try again.").assertIsDisplayed()
        compose.onNodeWithText("We couldn't resend the code. Please try again.").assertIsDisplayed()
        compose.onNodeWithText("Working…").assertIsDisplayed().assertIsNotEnabled()
    }

    @Test
    fun newPasswordStepEnforcesPolicyAndCallsCompletionOnlyFromSuccessContinuation() {
        var newPassword by mutableStateOf("")
        var confirmPassword by mutableStateOf("")
        var submittedPassword: String? = null
        var finishReset: (() -> Unit)? = null
        var completed = false
        compose.setContent {
            MaterialTheme {
                RecoveryFlowScreen(
                    step = RecoveryStep.NewPassword,
                    email = "ari@example.com",
                    code = "123456",
                    newPassword = newPassword,
                    confirmPassword = confirmPassword,
                    onEmailChange = {}, onCodeChange = {}, onNewPasswordChange = { newPassword = it }, onConfirmPasswordChange = { confirmPassword = it },
                    onSendCode = {}, onVerifyCode = {}, onResendCode = {},
                    onResetPassword = { password, success -> submittedPassword = password; finishReset = success },
                    onComplete = { completed = true },
                )
            }
        }

        compose.onNodeWithText("Create new password").assertIsDisplayed()
        compose.onNodeWithText("Save password").assertIsNotEnabled()
        compose.onNodeWithText("New password").performTextInput("Abcdef1!")
        compose.onNodeWithText("Confirm password").performTextInput("Abcdef1?")
        compose.onNodeWithText("Passwords don’t match.").assertIsDisplayed()
        compose.onNodeWithText("Confirm password").performTextClearance()
        compose.onNodeWithText("Confirm password").performTextInput("Abcdef1!")
        compose.onNodeWithText("Save password").assertIsEnabled().performClick()
        compose.runOnIdle {
            assertEquals("Abcdef1!", submittedPassword)
            assertTrue(finishReset != null)
            assertEquals(false, completed)
            finishReset?.invoke()
        }
        compose.runOnIdle { assertTrue(completed) }
    }
}
