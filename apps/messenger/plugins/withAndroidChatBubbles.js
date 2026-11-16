const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

const serviceSource = `package com.nantty.messenger

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
    val accountId = remoteMessage.data["recipientAccountId"]?.takeIf(String::isNotBlank) ?: return standard
    if (remoteMessage.data["bubbleAllowed"] != "true") return standard

    return runCatching { addConversationBubble(remoteMessage, accountId, conversationId, standard) }.getOrElse { standard }
  }

  @RequiresApi(Build.VERSION_CODES.R)
  private fun addConversationBubble(remoteMessage: RemoteMessage, accountId: String, conversationId: String, standard: Notification): Notification {
    val manager = context.getSystemService(NotificationManager::class.java) ?: return standard
    if (!manager.areBubblesAllowed() || manager.bubblePreference == NotificationManager.BUBBLE_PREFERENCE_NONE) return standard
    val parentChannelId = standard.channelId ?: remoteMessage.data["channelId"] ?: return standard
    val parentChannel = manager.getNotificationChannel(parentChannelId)
      ?: NotificationChannel(parentChannelId, "Messages", NotificationManager.IMPORTANCE_HIGH).apply { setAllowBubbles(true) }
    manager.createNotificationChannel(parentChannel)

    val shortcutManager = context.getSystemService(ShortcutManager::class.java) ?: return standard
    val encodedConversation = Uri.encode(conversationId)
    val scopedIdentity = UUID.nameUUIDFromBytes("\${accountId.length}:$accountId:\${conversationId.length}:$conversationId".toByteArray(Charsets.UTF_8)).toString()
    val shortcutId = "nantty-chat-$scopedIdentity"
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
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1 && shortcutManager.pinnedShortcuts.any { it.id == shortcutId && !it.isEnabled }) {
      shortcutManager.enableShortcuts(listOf(shortcutId))
    }
    shortcutManager.addDynamicShortcuts(listOf(shortcut))

    val conversationChannelId = "nantty-conversation-$scopedIdentity"
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
`;

const nativeModuleSource = `package com.nantty.messenger

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Person
import android.content.Context
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.uimanager.ViewManager

class NanttyChatBubblesPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(NanttyChatBubblesModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

class NanttyChatBubblesModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = "NanttyChatBubbles"

  @ReactMethod
  fun getCapabilities(promise: Promise) {
    val map = Arguments.createMap()
    val supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
    val notificationManager = reactContext.getSystemService(NotificationManager::class.java)
    val notificationsEnabled = NotificationManagerCompat.from(reactContext).areNotificationsEnabled()
    val runtimePermission = Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(reactContext, Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED
    val bubblePreference = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) notificationManager?.bubblePreference ?: NotificationManager.BUBBLE_PREFERENCE_NONE else NotificationManager.BUBBLE_PREFERENCE_NONE
    val systemEnabled = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && notificationManager?.areBubblesAllowed() == true && bubblePreference != NotificationManager.BUBBLE_PREFERENCE_NONE
    map.putBoolean("systemBubblesSupported", supported)
    map.putBoolean("notificationsEnabled", notificationsEnabled && runtimePermission)
    map.putBoolean("systemBubblesEnabled", systemEnabled)
    map.putInt("systemBubblePreference", bubblePreference)
    map.putString("status", when {
      !supported -> "unsupported"
      !notificationsEnabled || !runtimePermission -> "notification_permission_required"
      !systemEnabled -> "system_bubbles_disabled"
      else -> "ready"
    })
    promise.resolve(map)
  }

  @ReactMethod
  fun openBubbleSettings(promise: Promise) {
    val opened = openSettingsIntent(Settings.ACTION_APP_NOTIFICATION_BUBBLE_SETTINGS)
      || openSettingsIntent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
      || openSettingsIntent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:\${reactContext.packageName}"))
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
    val identity = "\${accountId.length}:$accountId:\${conversationId.length}:$conversationId"
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
    val identity = "\${accountId.length}:$accountId:\${conversationId.length}:$conversationId"
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
    val testUrl = Uri.parse("nantty-messenger://test-chat?surface=bubble-test")
    val testIntent = Intent(Intent.ACTION_VIEW, testUrl, reactContext, NanttyBubbleActivity::class.java)
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
      85471,
      testIntent,
      android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
    )
    val self = Person.Builder().setName("You").build()
    val system = Person.Builder().setName("Nantty Messenger").setIcon(icon).build()
    val style = Notification.MessagingStyle(self)
      .setConversationTitle("Local chat bubble test")
      .addMessage("This is a local test. No message was sent.", System.currentTimeMillis(), system)
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

    val systemAllows = notificationManager.areBubblesAllowed()
    val channelAllows = notificationManager.getNotificationChannel(channelId)?.canBubble() == true
    promise.resolve(Arguments.createMap().apply {
      putBoolean("notificationPosted", true)
      putBoolean("bubbleEligible", systemAllows && channelAllows)
      putString("status", if (systemAllows && channelAllows) "posted_eligible" else "posted_system_settings_may_block")
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
      .putExtra("android.provider.extra.APP_PACKAGE", reactContext.packageName)
      .putExtra("app_package", reactContext.packageName)
    if (data != null) intent.data = data
    reactContext.startActivity(intent)
  }.isSuccess

  companion object {
    private const val TEST_NOTIFICATION_ID = 85471
  }
}
`;

function withChatBubbleReceiver(config) {
  return withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    if (!application) return mod;
    mod.modResults.manifest["uses-permission"] = (mod.modResults.manifest["uses-permission"] ?? []).filter(({ $ }) => $?.["android:name"] !== "android.permission.SYSTEM_ALERT_WINDOW");
    mod.modResults.manifest["uses-permission"].push({ $: { "android:name": "android.permission.SYSTEM_ALERT_WINDOW", "tools:node": "remove" } });
    const expoNotificationReceiver = application.receiver?.find(({ $ }) => $?.["android:name"]?.endsWith(".service.NotificationsService"));
    if (expoNotificationReceiver) {
      expoNotificationReceiver.$["android:name"] = "com.nantty.messenger.NanttyNotificationsService";
      expoNotificationReceiver.$["android:enabled"] = "true";
      expoNotificationReceiver.$["android:exported"] = "false";
    } else {
      application.receiver ??= [];
      if (!application.receiver.some(({ $ }) => $?.["android:name"] === "com.nantty.messenger.NanttyNotificationsService")) {
        application.receiver.push(
          { $: { "android:name": "expo.modules.notifications.service.NotificationsService", "tools:node": "remove" } },
          {
            $: {
              "android:name": "com.nantty.messenger.NanttyNotificationsService",
              "android:enabled": "true",
              "android:exported": "false",
            },
            "intent-filter": [{
              $: { "android:priority": "100" },
              action: [
                { $: { "android:name": "expo.modules.notifications.NOTIFICATION_EVENT" } },
                { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
                { $: { "android:name": "android.intent.action.REBOOT" } },
                { $: { "android:name": "android.intent.action.MY_PACKAGE_REPLACED" } },
              ],
            }],
          },
        );
      }
    }
    const mainActivity = application.activity?.find(({ $ }) => $?.["android:name"]?.endsWith("MainActivity"));
    if (mainActivity) {
      delete mainActivity.$["android:allowEmbedded"];
      delete mainActivity.$["android:documentLaunchMode"];
    }
    application.activity ??= [];
    if (!application.activity.some(({ $ }) => $?.["android:name"] === ".NanttyBubbleActivity")) {
      application.activity.push({
        $: {
          "android:name": ".NanttyBubbleActivity",
          "android:allowEmbedded": "true",
          "android:resizeableActivity": "true",
          "android:exported": "false",
          "android:launchMode": "standard",
          "android:documentLaunchMode": "always",
          "android:theme": "@style/Theme.App.SplashScreen",
          "android:configChanges": "keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode|smallestScreenSize|assetsPaths",
        },
      });
    }
    return mod;
  });
}

function withChatBubbleSource(config) {
  return withDangerousMod(config, ["android", async (mod) => {
    const directory = path.join(mod.modRequest.platformProjectRoot, "app/src/main/java/com/nantty/messenger");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "NanttyNotificationsService.kt"), serviceSource);
    await fs.writeFile(path.join(directory, "NanttyChatBubblesModule.kt"), nativeModuleSource);
    await fs.writeFile(path.join(directory, "NanttyBubbleActivity.kt"), "package com.nantty.messenger\n\nclass NanttyBubbleActivity : MainActivity()\n");
    const mainActivityPath = path.join(directory, "MainActivity.kt");
    let mainActivitySource = await fs.readFile(mainActivityPath, "utf8");
    if (!mainActivitySource.includes("open class MainActivity : ReactActivity()")) {
      const finalClassDeclaration = "class MainActivity : ReactActivity()";
      if (!mainActivitySource.includes(finalClassDeclaration)) throw new Error("Could not prepare MainActivity for the embedded bubble Activity.");
      mainActivitySource = mainActivitySource.replace(finalClassDeclaration, "open class MainActivity : ReactActivity()");
      await fs.writeFile(mainActivityPath, mainActivitySource);
    }
    const applicationPath = path.join(directory, "MainApplication.kt");
    let applicationSource = await fs.readFile(applicationPath, "utf8");
    if (!applicationSource.includes("add(NanttyChatBubblesPackage())")) {
      const packageListLine = "PackageList(this).packages.apply {";
      if (!applicationSource.includes(packageListLine)) throw new Error("Could not register NanttyChatBubblesPackage: MainApplication package list was not found.");
      applicationSource = applicationSource.replace(packageListLine, `${packageListLine}\n          add(NanttyChatBubblesPackage())`);
      await fs.writeFile(applicationPath, applicationSource);
    }
    return mod;
  }]);
}

module.exports = function withAndroidChatBubbles(config) {
  return withChatBubbleSource(withChatBubbleReceiver(config));
};
