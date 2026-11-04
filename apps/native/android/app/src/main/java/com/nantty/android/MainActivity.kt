package com.nantty.android

import android.os.Bundle
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.nantty.android.ui.NanttyApp
import com.nantty.android.ui.theme.NanttyTheme
import com.nantty.android.widget.QUICK_ACTION_DESTINATION_EXTRA
import com.nantty.android.widget.quickActionDestination
import com.nantty.android.widget.OrdersWidgetRefreshScheduler

class MainActivity : ComponentActivity() {
    private var widgetDestination by mutableStateOf<String?>(null)

    override fun onResume() {
        super.onResume()
        OrdersWidgetRefreshScheduler.refreshSoon(applicationContext)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        widgetDestination = quickActionDestination(intent.getStringExtra(QUICK_ACTION_DESTINATION_EXTRA))?.routeKey
        setContent {
            NanttyTheme {
                val app = application as NanttyApplication
                NanttyApp(
                    sessionRepository = app.sessionRepository,
                    authFlowApi = app.authApi,
                    sessionExecutor = app.sessionExecutor,
                    requestedWidgetDestination = widgetDestination,
                    onWidgetDestinationHandled = { widgetDestination = null },
                )
            }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        widgetDestination = quickActionDestination(intent.getStringExtra(QUICK_ACTION_DESTINATION_EXTRA))?.routeKey
    }
}
