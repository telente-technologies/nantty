package com.nantty.android

import android.os.Bundle
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.fragment.app.FragmentActivity
import androidx.activity.compose.setContent
import com.nantty.android.ui.NanttyApp
import com.nantty.android.ui.theme.NanttyTheme
import com.nantty.android.widget.QUICK_ACTION_DESTINATION_EXTRA
import com.nantty.android.widget.quickActionDestination
import com.nantty.android.widget.OrdersWidgetRefreshScheduler
import com.nantty.android.notifications.PUSH_OPEN_INBOX_EXTRA
import com.nantty.android.notifications.isNotificationInboxTap
import com.nantty.android.notifications.PushTapTarget
import com.nantty.android.notifications.pushTapTargetFromIntent

class MainActivity : FragmentActivity() {
    private var widgetDestination by mutableStateOf<String?>(null)
    private var invitationToken by mutableStateOf<String?>(null)
    private var channelInvitationToken by mutableStateOf<String?>(null)
    private var notificationTarget by mutableStateOf<PushTapTarget?>(null)

    private fun consumeIntent(intent: android.content.Intent?) {
        val pushTap = isNotificationInboxTap(
            explicitPushExtra = intent?.getBooleanExtra(PUSH_OPEN_INBOX_EXTRA, false) == true,
            intentExtraKeys = intent?.extras?.keySet().orEmpty(),
        )
        notificationTarget = pushTapTargetFromIntent(intent)
        widgetDestination = if (pushTap && notificationTarget == null) "notifications"
        else quickActionDestination(intent?.getStringExtra(QUICK_ACTION_DESTINATION_EXTRA))?.routeKey
        val trustedHost = runCatching { java.net.URI(BuildConfig.NANTTY_WEBAPP_URL).host }
            .getOrNull()?.takeIf(String::isNotBlank) ?: "web.nantty.com"
        invitationToken = GroupInvitationDeepLink.tokenFrom(intent?.dataString, trustedHost)
        channelInvitationToken = ChannelInvitationDeepLink.tokenFrom(intent?.dataString, trustedHost)
    }

    override fun onResume() {
        super.onResume()
        OrdersWidgetRefreshScheduler.refreshSoon(applicationContext)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        consumeIntent(intent)
        setContent {
            NanttyTheme {
                val app = application as NanttyApplication
                NanttyApp(
                    sessionRepository = app.sessionRepository,
                    authFlowApi = app.authApi,
                    sessionExecutor = app.sessionExecutor,
                    requestedWidgetDestination = widgetDestination,
                    onWidgetDestinationHandled = { widgetDestination = null },
                    requestedNotificationTarget = notificationTarget,
                    onNotificationTargetHandled = { notificationTarget = null },
                    requestedGroupInvitationToken = invitationToken,
                    onGroupInvitationTokenHandled = { invitationToken = null },
                    requestedChannelInvitationToken = channelInvitationToken,
                    onChannelInvitationTokenHandled = { channelInvitationToken = null },
                )
            }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        consumeIntent(intent)
    }
}
