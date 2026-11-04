package com.nantty.android.ui.auth

import com.nantty.android.data.AuthValidation

private const val DEFAULT_RESEND_SECONDS = AuthValidation.OTP_RESEND_COOLDOWN_SECONDS

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

