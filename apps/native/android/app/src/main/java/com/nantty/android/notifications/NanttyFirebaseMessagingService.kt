package com.nantty.android.notifications

import android.Manifest
import android.app.Notification
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.nantty.android.NanttyApplication
import com.nantty.android.MainActivity
import com.nantty.android.R
import java.util.concurrent.atomic.AtomicInteger

class NanttyFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        NativePushRegistration.enqueueSync(this)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val app = application as? NanttyApplication ?: return
        if (!app.firebasePushConfigured) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val notificationManager = NotificationManagerCompat.from(this)
        if (!notificationManager.areNotificationsEnabled()) return
        val title = message.notification?.title?.take(MAX_TEXT_CHARS)
            ?: message.data["title"]?.take(MAX_TEXT_CHARS)
            ?: getString(R.string.app_name)
        val body = message.notification?.body?.take(MAX_TEXT_CHARS)
            ?: message.data["body"]?.take(MAX_TEXT_CHARS)
            ?: return
        if (body.isBlank()) return

        NanttyPushNotifications.ensureChannel(this)
        val openInbox = Intent(this, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(PUSH_OPEN_INBOX_EXTRA, true)
        resolvePushTapTarget(message.data)?.putOn(openInbox)
        val pendingIntent = PendingIntent.getActivity(
            this,
            message.messageId?.hashCode() ?: NEXT_NOTIFICATION_ID.getAndIncrement(),
            openInbox,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = Notification.Builder(this, getString(R.string.push_notification_channel_id))
            .setSmallIcon(R.drawable.ic_nantty)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()
        try {
            notificationManager.notify(message.messageId?.hashCode() ?: NEXT_NOTIFICATION_ID.getAndIncrement(), notification)
        } catch (_: SecurityException) {
            // Permission may be revoked after the explicit check and before delivery.
            return
        }
    }

    private companion object {
        const val MAX_TEXT_CHARS = 240
        val NEXT_NOTIFICATION_ID = AtomicInteger(1)
    }
}
