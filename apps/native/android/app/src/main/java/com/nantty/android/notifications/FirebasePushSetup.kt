package com.nantty.android.notifications

import android.content.Context
import com.google.firebase.FirebaseApp

internal object FirebasePushSetup {
    fun initialize(context: Context): Boolean {
        val options = FirebaseProjectConfig.fromBuildConfig().toFirebaseOptions() ?: return false
        return runCatching {
            val defaultAppExists = FirebaseApp.getApps(context).any { it.name == FirebaseApp.DEFAULT_APP_NAME }
            if (!defaultAppExists) FirebaseApp.initializeApp(context, options)
            FirebaseApp.getApps(context).any { it.name == FirebaseApp.DEFAULT_APP_NAME }
        }.getOrDefault(false)
    }
}
