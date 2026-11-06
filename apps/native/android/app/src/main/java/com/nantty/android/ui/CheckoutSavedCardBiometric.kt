package com.nantty.android.ui

import android.content.Context
import android.content.ContextWrapper
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

internal sealed interface SavedCardBiometricResult {
    data object Confirmed : SavedCardBiometricResult
    data object Cancelled : SavedCardBiometricResult
    data object Unavailable : SavedCardBiometricResult
    data class Failed(val message: String) : SavedCardBiometricResult
}

/** Starts a one-shot identity confirmation; saved-card credentials are read only by Confirmed callbacks. */
internal fun confirmSavedCardUse(
    context: Context,
    onResult: (SavedCardBiometricResult) -> Unit,
) {
    val activity = context.findFragmentActivityForSavedCard()
    if (activity == null || BiometricManager.from(activity)
            .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) != BiometricManager.BIOMETRIC_SUCCESS
    ) {
        onResult(SavedCardBiometricResult.Unavailable)
        return
    }

    val prompt = BiometricPrompt(
        activity,
        ContextCompat.getMainExecutor(activity),
        object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                onResult(SavedCardBiometricResult.Confirmed)
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                onResult(SavedCardBiometricResult.Cancelled)
            }

            override fun onAuthenticationFailed() {
                onResult(SavedCardBiometricResult.Failed("Biometric confirmation wasn't recognized. Try again."))
            }
        },
    )
    prompt.authenticate(
        BiometricPrompt.PromptInfo.Builder()
            .setTitle("Confirm saved card payment")
            .setSubtitle("Verify your identity before charging this card")
            .setNegativeButtonText("Cancel")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
            .build(),
    )
}

private fun Context.findFragmentActivityForSavedCard(): FragmentActivity? {
    var current: Context? = this
    while (current != null) {
        if (current is FragmentActivity) return current
        current = (current as? ContextWrapper)?.baseContext
    }
    return null
}
