package com.nantty.android.notifications

import com.nantty.android.BuildConfig
import com.google.firebase.FirebaseOptions

/** Public Firebase client identifiers only; server credentials never belong in the app. */
internal data class FirebaseProjectConfig(
    val appId: String,
    val apiKey: String,
    val projectId: String,
    val senderId: String,
) {
    val isComplete: Boolean
        get() = listOf(appId, apiKey, projectId, senderId).all(String::isNotBlank)

    fun toFirebaseOptions(): FirebaseOptions? {
        if (!isComplete) return null
        return FirebaseOptions.Builder()
            .setApplicationId(appId)
            .setApiKey(apiKey)
            .setProjectId(projectId)
            .setGcmSenderId(senderId)
            .build()
    }

    companion object {
        fun fromBuildConfig() = FirebaseProjectConfig(
            appId = BuildConfig.NANTTY_FIREBASE_APP_ID,
            apiKey = BuildConfig.NANTTY_FIREBASE_API_KEY,
            projectId = BuildConfig.NANTTY_FIREBASE_PROJECT_ID,
            senderId = BuildConfig.NANTTY_FIREBASE_SENDER_ID,
        )
    }
}
