package com.nantty.android

import android.app.Application
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.AuthApi
import com.nantty.android.data.EncryptedSessionStore
import com.nantty.android.widget.OrdersWidgetRefreshScheduler
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class NanttyApplication : Application() {
    val sessionExecutor: ExecutorService by lazy { Executors.newSingleThreadExecutor() }

    val sessionRepository: AccountSessionRepository by lazy {
        AccountSessionRepository(
            api = AuthApi(BuildConfig.NANTTY_API_BASE_URL),
            sessionStore = EncryptedSessionStore(this),
        )
    }

    override fun onCreate() {
        super.onCreate()
        OrdersWidgetRefreshScheduler.schedulePeriodic(this)
    }

}
