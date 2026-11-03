package com.nantty.android.widget

import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import com.nantty.android.data.OrdersWidgetSnapshot
import com.nantty.android.data.OrdersWidgetSnapshotStore
import com.nantty.android.data.OrdersWidgetState
import org.junit.Assert.assertEquals
import org.junit.Test

class OrdersGlanceWidgetTest {
    @Test
    fun launchWidgetUsesCompactLayoutAtItsDeclaredMinimum() {
        assertEquals(
            LaunchWidgetLayout.Compact,
            launchWidgetLayoutForSize(launchWidgetCompactSize),
        )
    }

    @Test
    fun launchWidgetUsesExpandedLayoutOnlyWhenBothDimensionsFit() {
        assertEquals(
            LaunchWidgetLayout.Expanded,
            launchWidgetLayoutForSize(launchWidgetExpandedSize),
        )
        assertEquals(
            LaunchWidgetLayout.Compact,
            launchWidgetLayoutForSize(DpSize(launchWidgetExpandedSize.width, 120.dp)),
        )
        assertEquals(
            LaunchWidgetLayout.Compact,
            launchWidgetLayoutForSize(DpSize(220.dp, launchWidgetExpandedSize.height)),
        )
    }

    @Test
    fun declaredMinimumUsesCompactLayout() {
        assertEquals(
            OrdersWidgetLayout.Compact,
            ordersWidgetLayoutForSize(OrdersWidgetCompactSize),
        )
    }

    @Test
    fun expandedLayoutRequiresEnoughWidthAndHeight() {
        assertEquals(
            OrdersWidgetLayout.Expanded,
            ordersWidgetLayoutForSize(OrdersWidgetExpandedSize),
        )
        assertEquals(
            OrdersWidgetLayout.Compact,
            ordersWidgetLayoutForSize(DpSize(OrdersWidgetExpandedSize.width, 120.dp)),
        )
        assertEquals(
            OrdersWidgetLayout.Compact,
            ordersWidgetLayoutForSize(DpSize(220.dp, OrdersWidgetExpandedSize.height)),
        )
    }

    @Test
    fun compactQuickActionsExposeFeedWalletAndMessages() {
        assertEquals(
            listOf(QuickActionDestination.Feed, QuickActionDestination.Wallet, QuickActionDestination.Messages),
            quickActionsForLayout(LaunchWidgetLayout.Compact),
        )
    }

    @Test
    fun expandedQuickActionsAlsoExposeTheExistingNewPostComposer() {
        assertEquals(
            listOf(
                QuickActionDestination.Feed,
                QuickActionDestination.NewPost,
                QuickActionDestination.Wallet,
                QuickActionDestination.Messages,
            ),
            quickActionsForLayout(LaunchWidgetLayout.Expanded),
        )
    }

    @Test
    fun widgetRouteKeysResolveOnlyToSupportedDestinations() {
        QuickActionDestination.entries.forEach { destination ->
            assertEquals(destination, quickActionDestination(destination.routeKey))
        }
        assertEquals(null, quickActionDestination(null))
        assertEquals(null, quickActionDestination("admin"))
    }

    @Test
    fun signedOutAndEmptyStatesDoNotExposeOrderDetails() {
        assertEquals("Sign in to see your order updates", ordersWidgetSubtitle(OrdersWidgetSnapshot(OrdersWidgetState.SIGNED_OUT)))
        assertEquals("No active orders", ordersWidgetSubtitle(OrdersWidgetSnapshot(OrdersWidgetState.EMPTY)))
    }

    @Test
    fun staleAndErrorStatesExplainThatTheWidgetMayNotBeCurrent() {
        val stale = OrdersWidgetSnapshot(OrdersWidgetState.STALE, activeCount = 2, statusLabels = listOf("Being prepared"), updatedAtMillis = 100)
        assertEquals("Update delayed · showing saved statuses", ordersWidgetSubtitle(stale))
        assertEquals("Could not refresh · open Nantty to retry", ordersWidgetSubtitle(OrdersWidgetSnapshot(OrdersWidgetState.ERROR)))
    }

    @Test
    fun oldSnapshotsAreRedactedAfterSixHours() {
        val sixHoursOld = OrdersWidgetSnapshot(OrdersWidgetState.READY, 2, listOf("Being prepared"), updatedAtMillis = 1_000)
        val redacted = currentOrdersWidgetSnapshot(sixHoursOld, 1_000 + OrdersWidgetSnapshotStore.MAX_STALE_DETAIL_AGE_MS + 1)
        assertEquals(OrdersWidgetState.STALE, redacted?.state)
        assertEquals(0, redacted?.activeCount)
        assertEquals(emptyList<String>(), redacted?.statusLabels)
    }
}
