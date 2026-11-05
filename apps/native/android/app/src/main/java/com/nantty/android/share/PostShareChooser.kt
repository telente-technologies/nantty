package com.nantty.android.share

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.chooser.ChooserResult
import androidx.annotation.RequiresApi
import androidx.core.content.IntentCompat
import com.nantty.android.BuildConfig
import com.nantty.android.NanttyApplication
import com.nantty.android.data.PostDetailRepository
import java.util.UUID

internal fun postShareText(
    postId: String,
    authorName: String? = null,
    webAppBaseUrl: String = BuildConfig.NANTTY_WEBAPP_URL,
): String {
    val configuredBase = Uri.parse(webAppBaseUrl.trim().trimEnd('/'))
    val isSecure = configuredBase.scheme == "https" && !configuredBase.host.isNullOrBlank() && configuredBase.userInfo == null
    val isEmulatorDevelopment = configuredBase.scheme == "http" && configuredBase.host == "10.0.2.2" && configuredBase.userInfo == null
    val baseUrl = if (isSecure || isEmulatorDevelopment) configuredBase.toString() else "https://web.nantty.com"
    val url = "$baseUrl/post/${Uri.encode(postId)}"
    return authorName?.takeIf(String::isNotBlank)?.let { "$it on Nantty: $url" } ?: url
}

internal fun sharePostFromAndroid(context: Context, postId: String, authorName: String? = null) {
    if (postId.isBlank()) return

    val sendIntent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, postShareText(postId, authorName))
    }
    val callbackIntent = Intent(context, PostShareSelectedReceiver::class.java)
        .setAction("${context.packageName}.POST_SHARE_${UUID.randomUUID()}")
        .putExtra(PostShareSelectedReceiver.POST_ID_EXTRA, postId)
    val callback = PendingIntent.getBroadcast(
        context,
        UUID.randomUUID().hashCode(),
        callbackIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
    )
    context.startActivity(
        Intent.createChooser(sendIntent, "Share post", callback.intentSender)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    )
}

internal fun selectedShareTarget(intent: Intent, sdkInt: Int = Build.VERSION.SDK_INT): ComponentName? {
    if (sdkInt >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            selectedShareTargetFromApi35(intent)
        } else null
    }
    @Suppress("DEPRECATION")
    return intent.getParcelableExtra(Intent.EXTRA_CHOSEN_COMPONENT) as? ComponentName
}

@RequiresApi(Build.VERSION_CODES.VANILLA_ICE_CREAM)
private fun selectedShareTargetFromApi35(intent: Intent): ComponentName? =
    IntentCompat.getParcelableExtra(intent, Intent.EXTRA_CHOOSER_RESULT, ChooserResult::class.java)
        ?.takeIf { it.type == ChooserResult.CHOOSER_RESULT_SELECTED_COMPONENT }
        ?.selectedComponent

internal class PostShareSelectedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (selectedShareTarget(intent) == null) return
        val postId = intent.getStringExtra(POST_ID_EXTRA)?.takeIf(String::isNotBlank) ?: return
        val pendingResult = goAsync()
        Thread({
            try {
                val app = context.applicationContext as? NanttyApplication ?: return@Thread
                PostDetailRepository(sessionProvider = app.sessionRepository::sessionOrNull).recordPostShare(postId)
            } finally {
                pendingResult.finish()
            }
        }, "nantty-post-share-record").start()
    }

    companion object {
        const val POST_ID_EXTRA = "com.nantty.android.share.POST_ID"
    }
}
