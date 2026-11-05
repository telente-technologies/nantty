package com.nantty.android.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.adaptive.separatingVerticalHingeBounds
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowSizeClass
import com.nantty.android.data.AccountUser

/** Stateless adaptive chrome; destination state and behavior remain owned by SignedInApp. */
@Composable
internal fun SignedInNavigationShell(
    destination: Destination,
    isGuest: Boolean,
    accountUser: AccountUser?,
    onSelectDestination: (Destination) -> Unit,
    onRefresh: () -> Unit,
    onOpenMart: () -> Unit,
    onSelectMart: (Boolean) -> Unit,
    onOpenCart: () -> Unit,
    onOpenOrders: () -> Unit,
    onSignOut: () -> Unit,
    topicSelector: @Composable () -> Unit,
    destinationContent: @Composable (Modifier, Boolean) -> Unit,
) {
    HingeSafeContent {
        Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
            val adaptiveInfo = currentWindowAdaptiveInfoV2()
            val windowSizeClass = adaptiveInfo.windowSizeClass
            val hasExpandedWidth = windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND)
            val isTabletop = adaptiveInfo.windowPosture.isTabletop
            val showMartCategoryPane = shouldShowMartCategoryPane(
                windowSizeClass = windowSizeClass,
                isTabletop = isTabletop,
                hasVerticalHinge = adaptiveInfo.windowPosture.separatingVerticalHingeBounds.isNotEmpty(),
            )
            if (shouldUseNavigationRail(windowSizeClass, isTabletop)) {
                Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.Center) {
                    NavigationRail(Modifier.fillMaxHeight(), containerColor = MaterialTheme.colorScheme.background) {
                        Spacer(Modifier.height(18.dp))
                        BrandMark()
                        Spacer(Modifier.height(28.dp))
                        visibleDestinations(isGuest).forEach { item ->
                            NavigationRailItem(
                                selected = destination == item,
                                onClick = { onSelectDestination(item) },
                                icon = { DestinationIcon(item) },
                                label = { Text(item.title) },
                            )
                        }
                    }
                    Column(
                        Modifier.weight(1f).widthIn(max = if (hasExpandedWidth) 680.dp else 620.dp).fillMaxHeight(),
                    ) {
                        SignedInNavigationHeader(destination, accountUser, onRefresh, onOpenMart, onSelectMart, onOpenCart, onOpenOrders, onSignOut)
                        if (destination == Destination.Feed && !isGuest) topicSelector()
                        destinationContent(Modifier.weight(1f), showMartCategoryPane)
                    }
                    if (hasExpandedWidth) {
                        Column(Modifier.width(280.dp).padding(start = 24.dp, top = 28.dp)) {
                            Text("Your Nantty", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(8.dp))
                            Text("A calmer corner of your social world.", color = MaterialTheme.colorScheme.secondary)
                        }
                    }
                }
            } else {
                Column(Modifier.fillMaxSize()) {
                    SignedInNavigationHeader(destination, accountUser, onRefresh, onOpenMart, onSelectMart, onOpenCart, onOpenOrders, onSignOut)
                    if (destination == Destination.Feed && !isGuest) topicSelector()
                    destinationContent(Modifier.weight(1f), showMartCategoryPane)
                    NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                        visibleDestinations(isGuest).forEach { item ->
                            NavigationBarItem(
                                selected = destination == item,
                                onClick = { onSelectDestination(item) },
                                icon = { DestinationIcon(item) },
                                label = { Text(item.title, maxLines = 1) },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SignedInNavigationHeader(
    destination: Destination,
    accountUser: AccountUser?,
    onRefresh: () -> Unit,
    onOpenMart: () -> Unit,
    onSelectMart: (Boolean) -> Unit,
    onOpenCart: () -> Unit,
    onOpenOrders: () -> Unit,
    onSignOut: () -> Unit,
) {
    AppHeader(
        onRefresh = onRefresh,
        onOpenMart = onOpenMart,
        onOpenCart = onOpenCart,
        onOpenOrders = onOpenOrders,
        accountUser = accountUser,
        onSignOut = onSignOut,
    )
    if (destination == Destination.Feed || destination == Destination.Mart) {
        FeedMartSectionTabs(selectedMart = destination == Destination.Mart, onSelectMart = onSelectMart)
    }
}
