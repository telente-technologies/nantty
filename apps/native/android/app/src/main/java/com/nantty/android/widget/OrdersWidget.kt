package com.nantty.android.widget

import android.content.Context
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.material3.ColorProviders
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import com.nantty.android.MainActivity
import com.nantty.android.R
import com.nantty.android.data.OrdersWidgetSnapshot
import com.nantty.android.data.OrdersWidgetSnapshotStore
import com.nantty.android.data.OrdersWidgetState

internal val OrdersWidgetCompactSize = DpSize(180.dp, 90.dp)
internal val OrdersWidgetExpandedSize = DpSize(260.dp, 170.dp)

internal enum class OrdersWidgetLayout {
    Compact,
    Expanded,
}

internal fun ordersWidgetLayoutForSize(size: DpSize): OrdersWidgetLayout =
    if (size.width >= OrdersWidgetExpandedSize.width && size.height >= OrdersWidgetExpandedSize.height) {
        OrdersWidgetLayout.Expanded
    } else {
        OrdersWidgetLayout.Compact
    }

private val ordersWidgetColors by lazy {
    ColorProviders(
        light = lightColorScheme(
            primary = Color(0xFF2043F5),
            onPrimary = Color.White,
            surface = Color(0xFFF7F8FC),
            onSurface = Color(0xFF171A24),
            surfaceVariant = Color(0xFFE8ECF8),
            onSurfaceVariant = Color(0xFF434A5B),
        ),
        dark = darkColorScheme(
            primary = Color(0xFFB8C3FF),
            onPrimary = Color(0xFF10226E),
            surface = Color(0xFF151923),
            onSurface = Color(0xFFF2F3F8),
            surfaceVariant = Color(0xFF252B3A),
            onSurfaceVariant = Color(0xFFD0D5E2),
        ),
    )
}

class OrdersGlanceWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(setOf(OrdersWidgetCompactSize, OrdersWidgetExpandedSize))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val snapshot = currentOrdersWidgetSnapshot(OrdersWidgetSnapshotStore(context).read(), System.currentTimeMillis())
        provideContent {
            GlanceTheme(colors = ordersWidgetColors) {
                OrdersWidgetContent(snapshot)
            }
        }
    }
}

class OrdersWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = OrdersGlanceWidget()
}

@Composable
private fun OrdersWidgetContent(snapshot: OrdersWidgetSnapshot?) {
    val expanded = ordersWidgetLayoutForSize(LocalSize.current) == OrdersWidgetLayout.Expanded
    val title = if (snapshot?.state == OrdersWidgetState.SIGNED_OUT) "Sign in to Nantty" else "Your orders"

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(GlanceTheme.colors.surface)
            .cornerRadius(24.dp)
            .clickable(actionStartActivity<MainActivity>())
            .padding(horizontal = if (expanded) 18.dp else 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.Vertical.CenterVertically,
        horizontalAlignment = Alignment.Horizontal.Start,
    ) {
        Row(verticalAlignment = Alignment.Vertical.CenterVertically) {
            Image(
                provider = ImageProvider(R.drawable.ic_nantty),
                contentDescription = null,
                modifier = GlanceModifier.size(if (expanded) 44.dp else 40.dp),
            )
            Column(modifier = GlanceModifier.padding(start = 12.dp)) {
                Text(
                    title,
                    style = TextStyle(
                        color = GlanceTheme.colors.onSurface,
                        fontSize = if (expanded) 20.sp else 18.sp,
                        fontWeight = FontWeight.Bold,
                    ),
                )
                Text(
                    ordersWidgetSubtitle(snapshot),
                    style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant, fontSize = 13.sp),
                )
            }
        }

        val statusLabels = snapshot?.statusLabels.orEmpty()
        if (expanded && statusLabels.isNotEmpty() && snapshot?.state in setOf(OrdersWidgetState.READY, OrdersWidgetState.STALE)) {
            Spacer(modifier = GlanceModifier.height(8.dp))
            statusLabels.take(3).forEach { label ->
                Text("•  $label", maxLines = 1, style = TextStyle(color = GlanceTheme.colors.onSurface, fontSize = 12.sp))
            }
        } else if (!expanded && statusLabels.isNotEmpty() && snapshot?.state == OrdersWidgetState.READY) {
            Text(
                statusLabels.first(),
                maxLines = 1,
                style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant, fontSize = 12.sp),
            )
        }

        if (expanded) {
            Spacer(modifier = GlanceModifier.height(6.dp))
            Text(
                "Open Nantty  →",
                style = TextStyle(color = GlanceTheme.colors.primary, fontSize = 12.sp, fontWeight = FontWeight.Bold),
            )
        }
    }
}

internal fun ordersWidgetSubtitle(snapshot: OrdersWidgetSnapshot?): String = when (snapshot?.state) {
    null -> "Preparing order updates…"
    OrdersWidgetState.SIGNED_OUT -> "Sign in to see your order updates"
    OrdersWidgetState.EMPTY -> "No active orders"
    OrdersWidgetState.READY -> "${snapshot.activeCount} active ${if (snapshot.activeCount == 1) "order" else "orders"}"
    OrdersWidgetState.STALE -> if (snapshot.statusLabels.isEmpty()) "Updates delayed · open Nantty to check" else "Update delayed · showing saved statuses"
    OrdersWidgetState.ERROR -> "Could not refresh · open Nantty to retry"
}

internal fun currentOrdersWidgetSnapshot(snapshot: OrdersWidgetSnapshot?, nowMillis: Long): OrdersWidgetSnapshot? {
    if (snapshot == null || snapshot.state !in setOf(OrdersWidgetState.READY, OrdersWidgetState.EMPTY, OrdersWidgetState.STALE)) return snapshot
    val age = snapshot.updatedAtMillis?.let { nowMillis - it }
    if (age != null && age in 0 until 2 * 60 * 60 * 1000L) return snapshot
    val mayShowMinimalStatus = age != null && age in 0..OrdersWidgetSnapshotStore.MAX_STALE_DETAIL_AGE_MS
    return snapshot.copy(
        state = OrdersWidgetState.STALE,
        activeCount = if (mayShowMinimalStatus) snapshot.activeCount else 0,
        statusLabels = if (mayShowMinimalStatus) snapshot.statusLabels else emptyList(),
    )
}
