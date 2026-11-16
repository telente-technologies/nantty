package com.nantty.messenger

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Person
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

class NanttyChatBubblesPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(NanttyChatBubblesModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

class NanttyChatBubblesModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = "NanttyChatBubbles"

  @ReactMethod
  fun getCapabilities(promise: Promise) {
    val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
    val manager = reactContext.getSystemService(NotificationManager::class.java)
    val notificationsEnabled = NotificationManagerCompat.from(reactContext).areNotificationsEnabled()
    val runtimePermission = Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(reactContext, Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED
    val bubblePreference = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) manager?.bubblePreference ?: NotificationManager.BUBBLE_PREFERENCE_NONE else NotificationManager.BUBBLE_PREFERENCE_NONE
    val systemEnabled = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && manager?.areBubblesAllowed() == true && bubblePreference != NotificationManager.BUBBLE_PREFERENCE_NONE
    promise.resolve(Arguments.createMap().apply {
      putBoolean("systemBubblesSupported", supported)
      putBoolean("notificationsEnabled", notificationsEnabled && runtimePermission)
      putBoolean("systemBubblesEnabled", systemEnabled)
      putInt("systemBubblePreference", bubblePreference)
      putString("status", when {
        !supported -> "unsupported"
        !notificationsEnabled || !runtimePermission -> "notification_permission_required"
        !systemEnabled -> "system_bubbles_disabled"
        else -> "ready"
      })
    })
  }

  @ReactMethod
  fun openBubbleSettings(promise: Promise) {
    val opened = openSettingsIntent(Settings.ACTION_APP_NOTIFICATION_BUBBLE_SETTINGS)
      || openSettingsIntent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
      || openSettingsIntent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${reactContext.packageName}"))
    promise.resolve(Arguments.createMap().apply {
      putBoolean("opened", opened)
      putString("status", if (opened) "opened" else "unavailable")
    })
  }

  @ReactMethod
  fun openConversationNotificationSettings(accountId: String, conversationId: String, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(Arguments.createMap().apply { putBoolean("opened", false); putString("status", "unsupported") })
      return
    }
    if (accountId.isBlank() || conversationId.isBlank()) {
      promise.resolve(Arguments.createMap().apply { putBoolean("opened", false); putString("status", "invalid_identity") })
      return
    }
    val identity = "${accountId.length}:$accountId:${conversationId.length}:$conversationId"
    val channelId = "nantty-conversation-" + java.util.UUID.nameUUIDFromBytes(identity.toByteArray(Charsets.UTF_8)).toString()
    val channelExists = reactContext.getSystemService(NotificationManager::class.java)?.getNotificationChannel(channelId) != null
    if (!channelExists) {
      promise.resolve(Arguments.createMap().apply { putBoolean("opened", false); putString("status", "channel_not_created") })
      return
    }
    val intent = Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
      .putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
      .putExtra(Settings.EXTRA_CHANNEL_ID, channelId)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val opened = runCatching { reactContext.startActivity(intent) }.isSuccess
    promise.resolve(Arguments.createMap().apply {
      putBoolean("opened", opened)
      putString("status", if (opened) "opened" else "unavailable")
    })
  }

  @ReactMethod
  fun getConversationNotificationChannelStatus(accountId: String, conversationId: String, promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(Arguments.createMap().apply { putString("status", "unsupported"); putBoolean("channelExists", false); putNull("canBubble"); putNull("importance") })
      return
    }
    if (accountId.isBlank() || conversationId.isBlank()) {
      promise.resolve(Arguments.createMap().apply { putString("status", "invalid_identity"); putBoolean("channelExists", false); putNull("canBubble"); putNull("importance") })
      return
    }
    val identity = "${accountId.length}:$accountId:${conversationId.length}:$conversationId"
    val channelId = "nantty-conversation-" + java.util.UUID.nameUUIDFromBytes(identity.toByteArray(Charsets.UTF_8)).toString()
    val channel = reactContext.getSystemService(NotificationManager::class.java)?.getNotificationChannel(channelId)
    promise.resolve(Arguments.createMap().apply {
      putBoolean("channelExists", channel != null)
      putNull("canBubble")
      putNull("importance")
      putString("status", if (channel == null) "channel_not_created" else "available")
      if (channel != null) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) putBoolean("canBubble", channel.canBubble())
        putInt("importance", channel.importance)
      }
    })
  }

  @ReactMethod
  fun sendTestBubble(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      promise.resolve(Arguments.createMap().apply { putString("status", "unsupported") })
      return
    }
    if (!NotificationManagerCompat.from(reactContext).areNotificationsEnabled()
      || (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(reactContext, Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED)) {
      promise.resolve(Arguments.createMap().apply { putString("status", "notification_permission_required") })
      return
    }

    val notificationManager = reactContext.getSystemService(NotificationManager::class.java)
    val shortcutManager = reactContext.getSystemService(ShortcutManager::class.java)
    if (notificationManager == null || shortcutManager == null) {
      promise.resolve(Arguments.createMap().apply { putString("status", "unavailable") })
      return
    }

    val channelId = "nantty-chat-bubble-test"
    val channel = notificationManager.getNotificationChannel(channelId)
      ?: NotificationChannel(channelId, "Chat bubble test", NotificationManager.IMPORTANCE_HIGH).apply {
        setAllowBubbles(true)
        setSound(null, null)
        enableVibration(false)
      }
    notificationManager.createNotificationChannel(channel)

    val shortcutId = "nantty-chat-bubble-test"
    val testIntent = Intent(Intent.ACTION_VIEW, Uri.parse("nantty-messenger://test-chat?surface=bubble-test"), reactContext, NanttyBubbleActivity::class.java)
      .setPackage(reactContext.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    val icon = Icon.createWithResource(reactContext, reactContext.applicationInfo.icon)
    val shortcut = ShortcutInfo.Builder(reactContext, shortcutId)
      .setShortLabel("Local bubble test")
      .setLongLived(true)
      .setIcon(icon)
      .setIntent(testIntent)
      .setCategories(setOf(ShortcutInfo.SHORTCUT_CATEGORY_CONVERSATION))
      .build()
    shortcutManager.addDynamicShortcuts(listOf(shortcut))

    val contentIntent = android.app.PendingIntent.getActivity(
      reactContext,
      TEST_NOTIFICATION_ID,
      testIntent,
      android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
    )
    val self = Person.Builder().setName("You").build()
    val nantty = Person.Builder().setName("Nantty Messenger").setIcon(icon).build()
    val style = Notification.MessagingStyle(self)
      .setConversationTitle("Local chat bubble test")
      .addMessage("This is a local test. No message was sent.", System.currentTimeMillis(), nantty)
    val bubble = Notification.BubbleMetadata.Builder(shortcutId).setDesiredHeight(560).build()
    val notification = Notification.Builder(reactContext, channelId)
      .setSmallIcon(reactContext.applicationInfo.icon)
      .setContentTitle("Nantty Messenger")
      .setContentText("Local chat bubble test")
      .setCategory(Notification.CATEGORY_MESSAGE)
      .setShortcutId(shortcutId)
      .setBubbleMetadata(bubble)
      .setContentIntent(contentIntent)
      .setStyle(style)
      .setAutoCancel(false)
      .build()
    notificationManager.notify(TEST_NOTIFICATION_ID, notification)

    val bubbleEligible = notificationManager.areBubblesAllowed() && notificationManager.getNotificationChannel(channelId)?.canBubble() == true
    promise.resolve(Arguments.createMap().apply {
      putBoolean("notificationPosted", true)
      putBoolean("bubbleEligible", bubbleEligible)
      putString("status", if (bubbleEligible) "posted_eligible" else "posted_system_settings_may_block")
    })
  }

  @ReactMethod
  fun clearAccountBubbleState(promise: Promise) {
    val shortcutManager = reactContext.getSystemService(ShortcutManager::class.java)
    val notificationManager = reactContext.getSystemService(NotificationManager::class.java)
    runCatching {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1) {
        val manager = shortcutManager
        if (manager != null) {
          val conversationIds = (manager.dynamicShortcuts + manager.pinnedShortcuts)
            .map { it.id }
            .filter { it.startsWith("nantty-chat-") }
            .distinct()
          if (conversationIds.isNotEmpty()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) manager.removeLongLivedShortcuts(conversationIds)
            else manager.disableShortcuts(conversationIds)
            manager.removeDynamicShortcuts(conversationIds)
          }
        }
      }
      notificationManager?.cancelAll()
    }
      .onSuccess { promise.resolve(true) }
      .onFailure { promise.reject("BUBBLE_CLEANUP_FAILED", it) }
  }

  private fun openSettingsIntent(action: String, data: Uri? = null): Boolean = runCatching {
    val intent = Intent(action).setPackage("com.android.settings").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      .putExtra(Settings.EXTRA_APP_PACKAGE, reactContext.packageName)
      .putExtra("app_package", reactContext.packageName)
    if (data != null) intent.data = data
    reactContext.startActivity(intent)
  }.isSuccess
}
