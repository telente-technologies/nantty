package com.nantty.messenger

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import androidx.annotation.RequiresApi
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.notifications.model.Notification as ExpoNotification
import expo.modules.notifications.notifications.model.NotificationBehaviorRecord
import expo.modules.notifications.notifications.model.triggers.FirebaseNotificationTrigger
import expo.modules.notifications.service.NotificationsService
import expo.modules.notifications.service.delegates.ExpoPresentationDelegate
import expo.modules.notifications.service.interfaces.PresentationDelegate
import java.util.UUID

class NanttyNotificationsService : NotificationsService() {
  override fun getPresentationDelegate(context: Context): PresentationDelegate = NanttyBubblePresentationDelegate(context)
}

private class NanttyBubblePresentationDelegate(context: Context) : ExpoPresentationDelegate(context) {
  override suspend fun createNotification(notification: ExpoNotification, notificationBehavior: NotificationBehaviorRecord?): Notification {
    val standard = super.createNotification(notification, notificationBehavior)
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return standard

    val trigger = notification.notificationRequest.trigger as? FirebaseNotificationTrigger ?: return standard
    val remoteMessage = trigger.remoteMessage
    val conversationId = remoteMessage.data["conversationId"]?.takeIf(String::isNotBlank) ?: return standard
    if (remoteMessage.data["bubbleAllowed"] != "true") return standard

    return runCatching { addConversationBubble(remoteMessage, conversationId, standard) }.getOrElse { standard }
  }

  @RequiresApi(Build.VERSION_CODES.R)
  private fun addConversationBubble(remoteMessage: RemoteMessage, conversationId: String, standard: Notification): Notification {
    val manager = context.getSystemService(NotificationManager::class.java) ?: return standard
    if (!manager.areBubblesAllowed() || manager.bubblePreference == NotificationManager.BUBBLE_PREFERENCE_NONE) return standard
    val parentChannelId = standard.channelId ?: remoteMessage.data["channelId"] ?: return standard
    val parentChannel = manager.getNotificationChannel(parentChannelId)
      ?: NotificationChannel(parentChannelId, "Messages", NotificationManager.IMPORTANCE_HIGH).apply { setAllowBubbles(true) }
    manager.createNotificationChannel(parentChannel)

    val shortcutManager = context.getSystemService(ShortcutManager::class.java) ?: return standard
    val encodedConversation = Uri.encode(conversationId)
    val shortcutId = "nantty-chat-" + UUID.nameUUIDFromBytes(conversationId.toByteArray()).toString()
    val deepLink = Intent(Intent.ACTION_VIEW, Uri.parse("nantty-messenger://chats/$encodedConversation?surface=bubble"))
      .setClass(context, NanttyBubbleActivity::class.java)
      .setPackage(context.packageName)
    val title = remoteMessage.notification?.title
      ?: remoteMessage.data["title"]
      ?: context.applicationInfo.loadLabel(context.packageManager).toString()
    val icon = Icon.createWithResource(context, context.applicationInfo.icon)
    val shortcut = ShortcutInfo.Builder(context, shortcutId)
      .setShortLabel(title.take(40))
      .setLongLived(true)
      .setIcon(icon)
      .setIntent(deepLink)
      .setCategories(setOf(ShortcutInfo.SHORTCUT_CATEGORY_CONVERSATION))
      .build()
    shortcutManager.addDynamicShortcuts(listOf(shortcut))

    val conversationChannelId = "nantty-conversation-" + UUID.nameUUIDFromBytes(conversationId.toByteArray()).toString()
    val conversationChannel = manager.getNotificationChannel(conversationChannelId)
      ?: NotificationChannel(conversationChannelId, "Conversation", parentChannel.importance).apply {
        setConversationId(parentChannelId, shortcutId)
        setAllowBubbles(true)
        setSound(parentChannel.sound, parentChannel.audioAttributes)
        enableVibration(parentChannel.shouldVibrate())
        parentChannel.vibrationPattern?.let { setVibrationPattern(it) }
        lockscreenVisibility = parentChannel.lockscreenVisibility
      }
    manager.createNotificationChannel(conversationChannel)
    if (manager.getNotificationChannel(conversationChannelId)?.canBubble() != true) return standard

    val bubble = Notification.BubbleMetadata.Builder(shortcutId)
      .setDesiredHeight(560)
      .build()
    val body = remoteMessage.notification?.body ?: remoteMessage.data["message"] ?: "New message"
    val senderName = remoteMessage.data["senderName"] ?: title
    val conversationKind = remoteMessage.data["conversationKind"]
    val sender = android.app.Person.Builder().setName(senderName).setIcon(icon).build()
    val appPerson = android.app.Person.Builder().setName(context.applicationInfo.loadLabel(context.packageManager)).build()
    val style = Notification.MessagingStyle(appPerson).apply {
      if (conversationKind == "group" || conversationKind == "channel") setConversationTitle(title)
    }
      .addMessage(Notification.MessagingStyle.Message(body, remoteMessage.sentTime, sender))

    return Notification.Builder.recoverBuilder(context, standard)
      .setChannelId(conversationChannelId)
      .setCategory(Notification.CATEGORY_MESSAGE)
      .setShortcutId(shortcutId)
      .setBubbleMetadata(bubble)
      .setStyle(style)
      .setOnlyAlertOnce(true)
      .build()
  }
}
