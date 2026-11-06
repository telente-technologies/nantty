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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.nantty.android.data.FeedRepository
import com.nantty.android.data.AccountSession
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.AuthFlowApi
import com.nantty.android.ui.auth.PendingGuestAction
import com.nantty.android.widget.OrdersWidgetRefreshScheduler
import com.nantty.android.notifications.NativePushRegistration
import com.nantty.android.notifications.ForegroundActivityHeartbeat
import com.nantty.android.notifications.PushTapTarget
import java.util.concurrent.Executor

internal enum class Destination(val title: String) {
    Feed("Home"), Clips("Clips"), Mart("Mart"), Discover("Discover"), Spaces("Spaces"), Live("Live"), Notifications("Activity"), Messages("Messages"), Wallet("Wallet"), Orders("Orders"), Profile("Profile"), Saved("Saved posts"), Business("Business tools"), FollowRequests("Follow requests"), GroupInvitations("Group invitations"), SupportRequests("Support requests"), DisputeDetail("Dispute"), CountryPreference("Country & currency"), ChatNotificationSettings("Chat settings"), ChatPasscode("Chat passcode")
}

internal fun visibleDestinations(isGuest: Boolean): List<Destination> =
    Destination.entries.filter { item ->
        if (isGuest) item == Destination.Feed || item == Destination.Clips || item == Destination.Mart || item == Destination.Discover || item == Destination.Spaces
        else item != Destination.Saved && item != Destination.Orders && item != Destination.Mart && item != Destination.Live && item != Destination.Business && item != Destination.FollowRequests && item != Destination.GroupInvitations && item != Destination.SupportRequests && item != Destination.DisputeDetail && item != Destination.CountryPreference && item != Destination.ChatNotificationSettings && item != Destination.ChatPasscode
    }

@Composable
fun NanttyApp(
    sessionRepository: AccountSessionRepository,
    authFlowApi: AuthFlowApi,
    sessionExecutor: Executor,
    repository: FeedRepository = remember { FeedRepository() },
    requestedWidgetDestination: String? = null,
    onWidgetDestinationHandled: () -> Unit = {},
    requestedNotificationTarget: PushTapTarget? = null,
    onNotificationTargetHandled: () -> Unit = {},
    requestedGroupInvitationToken: String? = null,
    onGroupInvitationTokenHandled: () -> Unit = {},
    requestedChannelInvitationToken: String? = null,
    onChannelInvitationTokenHandled: () -> Unit = {},
) {
    val appContext = LocalContext.current.applicationContext
    var session by remember { mutableStateOf<AccountSession?>(null) }
    var guestBrowsing by rememberSaveable { mutableStateOf(false) }
    var showingGuestAuth by rememberSaveable { mutableStateOf(false) }
    val pendingGuestAction = remember { PendingGuestAction() }
    var pendingFollowingAfterSignIn by rememberSaveable { mutableStateOf(false) }
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
                    NativePushRegistration.enqueueSync(appContext)
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

    LaunchedEffect(session?.accessToken) {
        if (session != null) {
            pendingGuestAction.takeAfterSignIn()?.invoke()
        }
    }

    ForegroundActivityHeartbeat(
        enabled = session != null,
        sessionRepository = sessionRepository,
        executor = sessionExecutor,
    )

    fun cancelGuestAuth() {
        pendingGuestAction.discard()
        showingGuestAuth = false
    }

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
                NativePushRegistration.enqueueSync(appContext)
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
            onRequireSignIn = { showingGuestAuth = true },
            onRequireSignInWithAction = { action ->
                pendingGuestAction.remember(action)
                showingGuestAuth = true
            },
            onRequireFollowingSignIn = {
                pendingFollowingAfterSignIn = true
                guestBrowsing = false
            },
            initialFollowingAfterSignIn = pendingFollowingAfterSignIn,
            onInitialFollowingHandled = { pendingFollowingAfterSignIn = false },
            onSignOut = {
                sessionWorking = true
                sessionError = null
                sessionExecutor.execute {
                    try {
                        sessionRepository.sessionOrNull()?.user?.id?.let {
                            NativePushRegistration.unregisterBeforeSignOut(appContext, it)
                        }
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
            requestedNotificationTarget = requestedNotificationTarget,
            onNotificationTargetHandled = onNotificationTargetHandled,
            requestedGroupInvitationToken = requestedGroupInvitationToken,
            onGroupInvitationTokenHandled = onGroupInvitationTokenHandled,
            requestedChannelInvitationToken = requestedChannelInvitationToken,
            onChannelInvitationTokenHandled = onChannelInvitationTokenHandled,
        )
        if (session == null && guestBrowsing && showingGuestAuth) {
            Dialog(
                onDismissRequest = ::cancelGuestAuth,
                properties = DialogProperties(usePlatformDefaultWidth = false),
            ) {
                Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
                    AuthGatewayScreen(
                        authApi = authFlowApi,
                        sessionRepository = sessionRepository,
                        executor = sessionExecutor,
                        initialError = null,
                        onRetryRestore = null,
                        dismissible = true,
                        onBrowseAsGuest = ::cancelGuestAuth,
                        onAuthenticated = { authenticated ->
                            OrdersWidgetRefreshScheduler.refreshSoon(appContext, replaceExisting = true)
                            NativePushRegistration.enqueueSync(appContext)
                            session = authenticated
                            guestBrowsing = false
                            showingGuestAuth = false
                            sessionError = null
                            sessionWorking = false
                        },
                    )
                }
            }
        }
    }
}
