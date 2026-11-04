package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.nantty.android.data.FeedRepository
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.AuthFlowApi
import com.nantty.android.widget.OrdersWidgetRefreshScheduler
import java.util.concurrent.Executor

internal enum class Destination(val title: String) {
    Feed("Home"), Mart("Mart"), Discover("Discover"), Notifications("Activity"), Messages("Messages"), Wallet("Wallet"), Orders("Orders"), Profile("Profile"), Saved("Saved posts")
}

internal fun visibleDestinations(isGuest: Boolean): List<Destination> =
    Destination.entries.filter { item ->
        if (isGuest) item == Destination.Feed || item == Destination.Mart || item == Destination.Discover
        else item != Destination.Saved && item != Destination.Orders && item != Destination.Mart
    }

@Composable
fun NanttyApp(
    sessionRepository: AccountSessionRepository,
    authFlowApi: AuthFlowApi,
    sessionExecutor: Executor,
    repository: FeedRepository = remember { FeedRepository() },
    requestedWidgetDestination: String? = null,
    onWidgetDestinationHandled: () -> Unit = {},
) {
    val appContext = LocalContext.current.applicationContext
    var session by remember { mutableStateOf<AccountSession?>(null) }
    var guestBrowsing by rememberSaveable { mutableStateOf(false) }
    var sessionLoading by remember { mutableStateOf(true) }
    var sessionWorking by remember { mutableStateOf(false) }
    var sessionError by remember { mutableStateOf<String?>(null) }
    fun restoreSession() {
        sessionLoading = true
        sessionWorking = true
        sessionError = null
        sessionExecutor.execute {
            try {
                val restored = sessionRepository.restore()
                if (restored != null) {
                    OrdersWidgetRefreshScheduler.refreshSoon(appContext, replaceExisting = true)
                } else {
                    OrdersWidgetRefreshScheduler.markSignedOut(appContext)
                }
                androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    session = restored
                    if (restored != null) guestBrowsing = false
                    sessionLoading = false
                    sessionWorking = false
                }
            } catch (error: Exception) {
                if (error is com.nantty.android.data.AuthApiException && error.statusCode in setOf(401, 403)) {
                    OrdersWidgetRefreshScheduler.markSignedOut(appContext)
                }
                androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                    sessionError = error.message ?: "Could not restore your session. Check your connection and try again."
                    sessionLoading = false
                    sessionWorking = false
                }
            }
        }
    }

    LaunchedEffect(sessionRepository) { restoreSession() }

    if (sessionLoading) {
        Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
    } else if (session == null && !guestBrowsing) {
        AuthGatewayScreen(
            authApi = authFlowApi,
            sessionRepository = sessionRepository,
            executor = sessionExecutor,
            initialError = sessionError,
            onRetryRestore = if (sessionError != null) ::restoreSession else null,
            onBrowseAsGuest = { guestBrowsing = true; sessionError = null },
            onAuthenticated = { authenticated ->
                OrdersWidgetRefreshScheduler.refreshSoon(appContext, replaceExisting = true)
                session = authenticated
                sessionError = null
                sessionWorking = false
            },
        )
    } else {
        SignedInApp(
            accountUser = session?.user,
            isGuest = session == null,
            sessionRepository = sessionRepository,
            onRequireSignIn = { guestBrowsing = false },
            onSignOut = {
                sessionWorking = true
                sessionError = null
                sessionExecutor.execute {
                    try {
                        sessionRepository.signOut()
                        OrdersWidgetRefreshScheduler.markSignedOut(appContext)
                        androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                            session = null
                            guestBrowsing = false
                            sessionLoading = false
                            sessionWorking = false
                        }
                    } catch (_: Exception) {
                        OrdersWidgetRefreshScheduler.markSignedOut(appContext)
                        androidx.compose.runtime.snapshots.Snapshot.withMutableSnapshot {
                            session = null
                            guestBrowsing = false
                            sessionLoading = false
                            sessionWorking = false
                            sessionError = "Signed out on this device. Nantty could not confirm server sign-out."
                        }
                    }
                }
            },
            repository = repository,
            requestedWidgetDestination = requestedWidgetDestination,
            onWidgetDestinationHandled = onWidgetDestinationHandled,
        )
    }
}
