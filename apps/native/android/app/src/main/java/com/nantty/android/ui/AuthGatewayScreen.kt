package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.Snapshot
import androidx.credentials.exceptions.GetCredentialCancellationException
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.AuthFlowApi
import com.nantty.android.data.AuthTopic
import com.nantty.android.data.AuthValidation
import com.nantty.android.data.GoogleIdentityProvider
import com.nantty.android.data.GoogleIdentityToken
import com.nantty.android.data.findActivityOrNull
import com.nantty.android.ui.auth.RegistrationFlowCallbacks
import com.nantty.android.ui.auth.RegistrationFlowScreen
import com.nantty.android.ui.auth.RegistrationFlowState
import com.nantty.android.ui.auth.RegistrationStep
import com.nantty.android.ui.auth.SocialBirthdayScreen
import com.nantty.android.ui.auth.RegistrationTopic
import com.nantty.android.ui.auth.UsernameAvailability
import com.nantty.android.ui.auth.recovery.RecoveryAuthFlow
import kotlinx.coroutines.launch
import java.util.concurrent.Executor

private enum class AuthRoute { Welcome, SignIn, Registration, SocialBirthday, Recovery }

/** Connects the native auth UI to API and session boundaries; form secrets remain in memory only. */
@Composable
internal fun AuthGatewayScreen(
    authApi: AuthFlowApi,
    sessionRepository: AccountSessionRepository,
    executor: Executor,
    initialError: String?,
    onRetryRestore: (() -> Unit)?,
    onBrowseAsGuest: () -> Unit,
    onAuthenticated: (AccountSession) -> Unit,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val googleClientId = com.nantty.android.BuildConfig.NANTTY_GOOGLE_SERVER_CLIENT_ID
    var route by remember { mutableStateOf(if (initialError == null) AuthRoute.Welcome else AuthRoute.SignIn) }
    var signInError by remember { mutableStateOf<String?>(initialError) }
    var signInWorking by remember { mutableStateOf(false) }
    var registration by remember {
        mutableStateOf(
            RegistrationFlowState(
                step = RegistrationStep.Welcome,
                saveLoginInfo = true,
                isAppleSignInAvailable = false,
                isGoogleSignInAvailable = googleClientId.isNotBlank(),
            ),
        )
    }
    var birthdayIso by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var otpToken by remember { mutableStateOf<String?>(null) }
    var pendingSession by remember { mutableStateOf<AccountSession?>(null) }
    var usernameCheckGeneration by remember { mutableStateOf(0) }
    var googleIdentity by remember { mutableStateOf<GoogleIdentityToken?>(null) }
    var socialBirthday by remember { mutableStateOf("") }
    var socialBirthdayError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(registration.resendSecondsRemaining, registration.step) {
        if (registration.step == RegistrationStep.VerifyCode && registration.resendSecondsRemaining > 0) {
            kotlinx.coroutines.delay(1_000)
            registration = registration.copy(resendSecondsRemaining = registration.resendSecondsRemaining - 1)
        }
    }

    fun update(patch: (RegistrationFlowState) -> RegistrationFlowState) {
        registration = patch(registration)
    }

    fun <T> submit(
        start: (RegistrationFlowState) -> RegistrationFlowState,
        request: () -> T,
        onSuccess: (T) -> Unit,
        onFailure: (String) -> Unit,
    ) {
        registration = start(registration)
        executor.execute {
            try {
                val result = request()
                Snapshot.withMutableSnapshot {
                    onSuccess(result)
                }
            } catch (failure: Exception) {
                Snapshot.withMutableSnapshot {
                    onFailure(failure.message ?: "We couldn't complete that step. Please try again.")
                }
            }
        }
    }

    fun exchangeGoogle(identity: GoogleIdentityToken, birthday: String? = null) {
        signInWorking = true
        signInError = null
        executor.execute {
            try {
                val session = authApi.signInWithGoogle(identity.idToken, identity.nonce, birthday)
                val persisted = sessionRepository.signInWithSession(session)
                Snapshot.withMutableSnapshot {
                    signInWorking = false
                    update { it.copy(activeSocialProvider = null, socialSignInError = null) }
                    googleIdentity = null
                    socialBirthday = ""
                    onAuthenticated(persisted)
                }
            } catch (failure: Exception) {
                Snapshot.withMutableSnapshot {
                    signInWorking = false
                    if ((failure as? com.nantty.android.data.AuthApiException)?.code == "BIRTHDAY_REQUIRED" && birthday == null) {
                        update { it.copy(activeSocialProvider = null, socialSignInError = null) }
                        googleIdentity = identity
                        socialBirthdayError = null
                        route = AuthRoute.SocialBirthday
                    } else if ((failure as? com.nantty.android.data.AuthApiException)?.code == "BELOW_MINIMUM_AGE") {
                        update { it.copy(activeSocialProvider = null, socialSignInError = null) }
                        socialBirthdayError = "You must be at least ${AuthValidation.MINIMUM_ACCOUNT_AGE_YEARS} to use Nantty. Your birthday wasn’t saved."
                        route = AuthRoute.SocialBirthday
                    } else {
                        update { it.copy(activeSocialProvider = null, socialSignInError = failure.message ?: "Google sign-in didn’t complete. Please try again.") }
                    }
                }
            }
        }
    }

    fun startGoogleSignIn() {
        if (signInWorking) return
        val activity = context.findActivityOrNull()
        if (activity == null) {
            update { it.copy(socialSignInError = "Google sign-in is unavailable in this app context.") }
            return
        }
        signInWorking = true
        signInError = null
        update { it.copy(activeSocialProvider = "google", socialSignInError = null) }
        coroutineScope.launch {
            try {
                val identity = GoogleIdentityProvider(
                    credentialManager = androidx.credentials.CredentialManager.create(context),
                    activity = activity,
                    serverClientId = googleClientId,
                ).signIn()
                signInWorking = false
                exchangeGoogle(identity)
            } catch (failure: Exception) {
                signInWorking = false
                update {
                    it.copy(
                        activeSocialProvider = null,
                        socialSignInError = if (failure is GetCredentialCancellationException) null
                        else failure.message ?: "Google sign-in wasn’t available. Please try again.",
                    )
                }
            }
        }
    }

    when (route) {
        AuthRoute.Welcome, AuthRoute.Registration -> RegistrationFlowScreen(
            state = registration,
            callbacks = RegistrationFlowCallbacks(
                onStartSignup = { route = AuthRoute.Registration; update { it.copy(step = RegistrationStep.Contact, socialSignInError = null) } },
                onContinueWithApple = {},
                onContinueWithGoogle = ::startGoogleSignIn,
                onLogin = { signInError = null; route = AuthRoute.SignIn },
                onWelcomeDismiss = { route = AuthRoute.SignIn },
                onBrowseAsGuest = onBrowseAsGuest,
                onBack = {
                    when (registration.step) {
                        RegistrationStep.Welcome -> route = AuthRoute.SignIn
                        RegistrationStep.Contact -> { password = ""; otpToken = null; route = AuthRoute.Welcome; update { it.copy(step = RegistrationStep.Welcome, destination = "") } }
                        RegistrationStep.VerifyCode -> update { it.copy(step = RegistrationStep.Contact, destination = "", verificationError = null) }
                        RegistrationStep.Birthday -> { otpToken = null; update { it.copy(step = RegistrationStep.Contact, destination = "", verificationError = null) } }
                        RegistrationStep.Password -> { password = ""; update { it.copy(step = RegistrationStep.Birthday) } }
                        RegistrationStep.Username -> { password = ""; update { it.copy(step = RegistrationStep.Password) } }
                        RegistrationStep.Personalization -> pendingSession?.let(onAuthenticated) ?: run { route = AuthRoute.SignIn }
                    }
                },
                onSendCode = { email ->
                    submit(
                        start = { it.copy(isSendingCode = true, emailError = null, noticeMessage = null) },
                        request = { authApi.sendOtp(email, "signup") },
                        onSuccess = { update { it.copy(isSendingCode = false, destination = email, step = RegistrationStep.VerifyCode, resendSecondsRemaining = AuthValidation.OTP_RESEND_COOLDOWN_SECONDS) } },
                        onFailure = { message -> update { it.copy(isSendingCode = false, emailError = message) } },
                    )
                },
                onSaveLoginInfoChanged = { enabled -> update { it.copy(saveLoginInfo = enabled) } },
                onVerifyCode = { code ->
                    submit(
                        start = { it.copy(isVerifyingCode = true, verificationError = null) },
                        request = { authApi.verifyOtp(registration.destination, code, "signup") },
                        onSuccess = { verified -> otpToken = verified; update { it.copy(isVerifyingCode = false, step = RegistrationStep.Birthday) } },
                        onFailure = { message -> update { it.copy(isVerifyingCode = false, verificationError = message) } },
                    )
                },
                onResendCode = {
                    if (registration.resendSecondsRemaining == 0 && !registration.isResendingCode) {
                        submit(
                            start = { it.copy(isResendingCode = true, noticeMessage = null, verificationError = null) },
                            request = { authApi.sendOtp(registration.destination, "signup") },
                            onSuccess = { update { it.copy(isResendingCode = false, resendSecondsRemaining = AuthValidation.OTP_RESEND_COOLDOWN_SECONDS, noticeMessage = "We sent you a new code.") } },
                            onFailure = { message -> update { it.copy(isResendingCode = false, verificationError = message) } },
                        )
                    }
                },
                onBirthdayContinue = { date -> birthdayIso = date; update { it.copy(step = RegistrationStep.Password, birthdayError = null) } },
                onPasswordContinue = { value ->
                    password = value
                    update { it.copy(step = RegistrationStep.Username, suggestedUsername = "", usernameAvailability = UsernameAvailability.Idle) }
                    val emailSeed = registration.destination
                    submit(
                        start = { it },
                        request = { authApi.usernameSuggestion(emailSeed) },
                        onSuccess = { suggestion ->
                            if (registration.step == RegistrationStep.Username && registration.suggestedUsername.isBlank()) {
                                update { it.copy(suggestedUsername = suggestion) }
                            }
                        },
                        onFailure = {},
                    )
                },
                onCreateAccount = { username ->
                    val verifiedOtp = otpToken
                    if (verifiedOtp == null) {
                        update { it.copy(usernameError = "Your verification expired. Go back and request a new code.") }
                    } else {
                        submit(
                            start = { it.copy(isCreatingAccount = true, usernameError = null) },
                            request = { authApi.register(registration.destination, birthdayIso, password, username.takeIf(String::isNotBlank), verifiedOtp) },
                            onSuccess = { created ->
                                try {
                                    val active = sessionRepository.signInWithSession(created, rememberOnDevice = registration.saveLoginInfo)
                                    pendingSession = active
                                    otpToken = null
                                    password = ""
                                    update { it.copy(isCreatingAccount = false, step = RegistrationStep.Personalization) }
                                } catch (failure: Exception) {
                                    update { it.copy(isCreatingAccount = false, usernameError = failure.message ?: "Could not securely save your session on this device.") }
                                }
                            },
                            onFailure = { message -> update { it.copy(isCreatingAccount = false, usernameError = message) } },
                        )
                    }
                },
                onUsernameAvailability = { username ->
                    val generation = ++usernameCheckGeneration
                    submit(
                        start = { it.copy(usernameAvailability = UsernameAvailability.Checking, usernameError = null) },
                        request = { authApi.usernameAvailability(username) },
                        onSuccess = { available ->
                            if (generation == usernameCheckGeneration && registration.step == RegistrationStep.Username) {
                                update {
                                    it.copy(
                                        usernameAvailability = if (available.available) UsernameAvailability.Available else UsernameAvailability.Unavailable,
                                        usernameAvailabilityMessage = available.message ?: available.reason?.availabilityMessage() ?: if (available.available) "Username is available." else "That username isn’t available. Try another one.",
                                        usernameSuggestions = available.suggestions,
                                    )
                                }
                            }
                        },
                        onFailure = { message ->
                            if (generation == usernameCheckGeneration && registration.step == RegistrationStep.Username) {
                                update { it.copy(usernameAvailability = UsernameAvailability.Unavailable, usernameAvailabilityMessage = message) }
                            }
                        },
                    )
                },
                onTopicsLoad = {
                    if (!registration.isLoadingTopics) {
                        submit(
                            start = { it.copy(isLoadingTopics = true, topicsError = null) },
                            request = { authApi.topics(pendingSession?.accessToken.orEmpty()) },
                            onSuccess = { topics -> update { it.copy(isLoadingTopics = false, topics = topics.map(AuthTopic::toRegistrationTopic)) } },
                            onFailure = { message -> update { it.copy(isLoadingTopics = false, topicsError = message) } },
                        )
                    }
                },
                onSaveTopics = { topicIds ->
                    val active = pendingSession
                    if (active != null) {
                        submit(
                            start = { it.copy(isSavingTopics = true, isCustomizingFeed = true) },
                            request = { runCatching { authApi.saveTopics(active.accessToken, topicIds.toList()) }; active },
                            onSuccess = { authenticated ->
                                otpToken = null
                                password = ""
                                onAuthenticated(authenticated)
                            },
                            onFailure = { onAuthenticated(active) },
                        )
                    } else {
                        route = AuthRoute.SignIn
                    }
                },
                onSkipTopics = {
                    pendingSession?.let(onAuthenticated) ?: run { route = AuthRoute.SignIn }
                    otpToken = null
                    password = ""
                },
                onTopicSelectionChanged = {},
            ),
        )

        AuthRoute.SignIn -> SignInScreen(
            loading = signInWorking,
            error = signInError ?: registration.socialSignInError,
            onRetryRestore = onRetryRestore,
            onCreateAccount = { route = AuthRoute.Registration; update { it.copy(step = RegistrationStep.Contact) } },
            onForgotPassword = { signInError = null; route = AuthRoute.Recovery },
            onBrowseAsGuest = onBrowseAsGuest,
            onGoogleSignIn = ::startGoogleSignIn.takeIf { googleClientId.isNotBlank() },
            onSignIn = { identifier, pass ->
                signInWorking = true
                signInError = null
                executor.execute {
                    try {
                        val signedIn = sessionRepository.signIn(identifier, pass)
                        Snapshot.withMutableSnapshot { signInWorking = false; onAuthenticated(signedIn) }
                    } catch (failure: Exception) {
                        Snapshot.withMutableSnapshot {
                            // Parent owns restore errors; expose this attempt's error in the local sign-in surface.
                            signInError = failure.message ?: "Could not sign in. Check your details and try again."
                            signInWorking = false
                        }
                    }
                }
            },
        )

        AuthRoute.SocialBirthday -> SocialBirthdayScreen(
            value = socialBirthday,
            error = socialBirthdayError,
            busy = signInWorking,
            onValueChange = { input -> socialBirthday = input; socialBirthdayError = null },
            onBack = { googleIdentity = null; socialBirthday = ""; socialBirthdayError = null; route = AuthRoute.Welcome },
            onContinue = {
                val isoBirthday = AuthValidation.validBirthdayIso(socialBirthday)
                val identity = googleIdentity
                if (identity == null) {
                    route = AuthRoute.Welcome
                    signInError = "Your Google sign-in expired. Please try again."
                } else if (isoBirthday == null) {
                    socialBirthdayError = "Enter a real date and make sure you meet Nantty’s minimum age requirement."
                } else {
                    socialBirthdayError = null
                    exchangeGoogle(identity, isoBirthday)
                }
            },
        )

        AuthRoute.Recovery -> RecoveryAuthFlow(authApi, executor) { route = AuthRoute.SignIn }
    }
}

private fun String?.availabilityMessage(): String? = when (this) {
    "taken", "reserved", "recently_used", "withheld", "invalid" -> "That username isn’t available. Try another one."
    else -> null
}

private fun AuthTopic.toRegistrationTopic() = RegistrationTopic(id, name)
