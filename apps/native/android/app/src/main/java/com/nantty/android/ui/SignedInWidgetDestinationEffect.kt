package com.nantty.android.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import com.nantty.android.widget.QuickActionDestination
import com.nantty.android.widget.quickActionDestination

/** Resolves a widget quick action once, then returns control to the destination owner. */
@Composable
internal fun SignedInWidgetDestinationEffect(
    requestedDestination: String?,
    isGuest: Boolean,
    onRequireSignIn: () -> Unit,
    onSelectDestination: (Destination) -> Unit,
    onShowComposer: (Boolean) -> Unit,
    onHandled: () -> Unit,
) {
    LaunchedEffect(requestedDestination) {
        if (isGuest && requestedDestination != null) {
            onRequireSignIn()
            onHandled()
            return@LaunchedEffect
        }
        if (requestedDestination == "notifications") {
            onSelectDestination(Destination.Notifications)
            onShowComposer(false)
            onHandled()
            return@LaunchedEffect
        }
        when (quickActionDestination(requestedDestination)) {
            QuickActionDestination.Feed -> {
                onSelectDestination(Destination.Feed)
                onShowComposer(false)
            }
            QuickActionDestination.NewPost -> {
                onSelectDestination(Destination.Feed)
                onShowComposer(true)
            }
            QuickActionDestination.Wallet -> {
                onSelectDestination(Destination.Wallet)
                onShowComposer(false)
            }
            QuickActionDestination.Messages -> {
                onSelectDestination(Destination.Messages)
                onShowComposer(false)
            }
            null -> return@LaunchedEffect
        }
        onHandled()
    }
}
