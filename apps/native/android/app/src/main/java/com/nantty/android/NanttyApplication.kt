package com.nantty.android

import android.app.Application
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.AuthApi
import com.nantty.android.data.EncryptedSessionStore
import com.nantty.android.widget.OrdersWidgetRefreshScheduler
import com.nantty.android.notifications.FirebasePushSetup
import com.nantty.android.notifications.NanttyPushNotifications
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class NanttyApplication : Application() {
    @Volatile var firebasePushConfigured: Boolean = false
        private set
    val sessionExecutor: ExecutorService by lazy { Executors.newSingleThreadExecutor() }

    val authApi: AuthApi by lazy { AuthApi(BuildConfig.NANTTY_API_BASE_URL) }

    val sessionRepository: AccountSessionRepository by lazy {
        AccountSessionRepository(
            api = authApi,
            sessionStore = EncryptedSessionStore(this),
        )
    }

    override fun onCreate() {
        super.onCreate()
        firebasePushConfigured = FirebasePushSetup.initialize(this)
        NanttyPushNotifications.ensureChannel(this)
        OrdersWidgetRefreshScheduler.schedulePeriodic(this)
    }

}
