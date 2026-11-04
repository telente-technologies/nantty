package com.nantty.android.data

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.util.Base64
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import java.security.SecureRandom

data class GoogleIdentityToken(val idToken: String, val nonce: String)

/** Android's Google identity boundary. The returned ID token must only be trusted after API verification. */
class GoogleIdentityProvider(
    private val credentialManager: CredentialManager,
    private val activity: Activity,
    private val serverClientId: String,
) {
    suspend fun signIn(): GoogleIdentityToken {
        require(serverClientId.isNotBlank()) { "Google sign-in is not configured for this build." }
        val nonce = secureNonce()
        val option = GetSignInWithGoogleOption.Builder(serverClientId)
            .setNonce(nonce)
            .build()
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(option)
            .build()
        val result = credentialManager.getCredential(activity, request)
        val credential = result.credential as? CustomCredential
            ?: throw IllegalStateException("Google did not return a supported sign-in credential.")
        if (credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            throw IllegalStateException("Google did not return an identity token.")
        }
        val googleCredential = GoogleIdTokenCredential.createFrom(credential.data)
        return GoogleIdentityToken(googleCredential.idToken, nonce)
    }

    private fun secureNonce(): String = ByteArray(NONCE_BYTES).also(SecureRandom()::nextBytes)
        .let { Base64.encodeToString(it, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING) }

    companion object {
        private const val NONCE_BYTES = 32
    }
}

internal fun Context.findActivityOrNull(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivityOrNull()
    else -> null
}
