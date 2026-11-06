package com.nantty.android.notifications

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.google.android.gms.tasks.Tasks
import com.google.firebase.messaging.FirebaseMessaging
import com.nantty.android.NanttyApplication
import com.nantty.android.data.AccountNotificationSettingsRepository
import com.nantty.android.data.AccountNotificationSettingsResult
import com.nantty.android.data.PushDeviceTokenRepository
import java.util.concurrent.TimeUnit

internal object NativePushRegistration {
    fun enqueueSync(context: Context) {
        val app = context.applicationContext as? NanttyApplication ?: return
        val request = OneTimeWorkRequestBuilder<PushTokenSyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(androidx.work.BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(app).enqueueUniqueWork(SYNC_WORK, ExistingWorkPolicy.REPLACE, request)
    }

    /** Best-effort revocation before local credentials are discarded at sign-out. */
    fun unregisterBeforeSignOut(context: Context, userId: String) {
        val app = context.applicationContext as? NanttyApplication ?: return
        val store = PushTokenStore(app)
        val token = store.read(userId)
        val shouldRevoke = pushTokenSyncAction(
            accountPreferenceEnabled = false,
            osPermissionGranted = false,
            firebaseConfigured = app.firebasePushConfigured,
            hasStoredRegistration = !token.isNullOrBlank(),
        ) == PushTokenSyncAction.REVOKE
        if (!shouldRevoke) {
            if (app.firebasePushConfigured) {
                runCatching { FirebaseMessaging.getInstance().isAutoInitEnabled = false }
                runCatching { Tasks.await(FirebaseMessaging.getInstance().deleteToken(), 10, TimeUnit.SECONDS) }
            }
            return
        }
        val repository = PushDeviceTokenRepository(
            sessionProvider = { app.sessionRepository.sessionOrNull()?.takeIf { it.user.id == userId } },
            refreshSessionProvider = app.sessionRepository::refreshSession,
        )
        if (repository.unregister(requireNotNull(token)).isFailure) return
        store.clear(userId)
        if (app.firebasePushConfigured) {
            runCatching { FirebaseMessaging.getInstance().isAutoInitEnabled = false }
            runCatching { Tasks.await(FirebaseMessaging.getInstance().deleteToken(), 10, TimeUnit.SECONDS) }
        }
    }

    internal fun hasPermission(context: Context): Boolean {
        val runtimeGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? android.app.NotificationManager
        return runtimeGranted && manager?.areNotificationsEnabled() != false
    }

    private const val SYNC_WORK = "nantty_fcm_token_sync"
}

internal const val PUSH_OPEN_INBOX_EXTRA = "com.nantty.android.notifications.open_inbox"

internal class PushTokenSyncWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val app = applicationContext as? NanttyApplication ?: return Result.success()

        val session = try {
            app.sessionRepository.sessionOrNull() ?: app.sessionRepository.restore()
        } catch (_: Exception) {
            return Result.retry()
        } ?: return Result.success()

        val registeredTokens = PushTokenStore(app)
        val repository = PushDeviceTokenRepository(
            sessionProvider = app.sessionRepository::sessionOrNull,
            refreshSessionProvider = app.sessionRepository::refreshSession,
        )
        val storedTokenExists = !registeredTokens.read(session.user.id).isNullOrBlank()
        if (!app.firebasePushConfigured) {
            return when (pushTokenSyncAction(false, false, false, storedTokenExists)) {
                PushTokenSyncAction.REVOKE -> revokeRegisteredToken(repository, registeredTokens, session.user.id, firebaseConfigured = false)
                PushTokenSyncAction.NO_OP, PushTokenSyncAction.REGISTER -> Result.success()
            }
        }

        val tokenSettings = AccountNotificationSettingsRepository(
            sessionProvider = app.sessionRepository::sessionOrNull,
        ).load()
        val accountOptedIn = when (tokenSettings) {
            is AccountNotificationSettingsResult.Success -> tokenSettings.settings.pushNotificationsEnabled
            is AccountNotificationSettingsResult.Failure -> return Result.retry()
        }
        when (pushTokenSyncAction(accountOptedIn, NativePushRegistration.hasPermission(app), true, storedTokenExists)) {
            PushTokenSyncAction.NO_OP -> return Result.success()
            PushTokenSyncAction.REVOKE -> return revokeRegisteredToken(repository, registeredTokens, session.user.id, firebaseConfigured = true)
            PushTokenSyncAction.REGISTER -> Unit
        }

        return try {
            val messaging = FirebaseMessaging.getInstance()
            messaging.isAutoInitEnabled = true
            val token = Tasks.await(messaging.token, TOKEN_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            if (token.isBlank()) return Result.retry()
            val registered = repository.register(token)
            if (registered.isFailure) return Result.retry()
            registeredTokens.write(session.user.id, token)
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    private fun revokeRegisteredToken(
        repository: PushDeviceTokenRepository,
        store: PushTokenStore,
        accountId: String,
        firebaseConfigured: Boolean,
    ): Result {
        return try {
            if (firebaseConfigured) FirebaseMessaging.getInstance().isAutoInitEnabled = false
            val token = store.read(accountId)
            if (token != null) {
                val result = repository.unregister(token)
                if (result.isFailure) return Result.retry()
                store.clear(accountId)
            }
            if (firebaseConfigured) {
                runCatching { Tasks.await(FirebaseMessaging.getInstance().deleteToken(), TOKEN_TIMEOUT_SECONDS, TimeUnit.SECONDS) }
            }
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    private companion object {
        const val TOKEN_TIMEOUT_SECONDS = 25L
    }
}
