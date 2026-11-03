package com.nantty.android.widget

import android.content.Context
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionStartActivity
import androidx.glance.action.actionParametersOf
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
import androidx.glance.layout.width
import androidx.glance.material3.ColorProviders
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import com.nantty.android.MainActivity
import com.nantty.android.R

internal val launchWidgetCompactSize = DpSize(180.dp, 90.dp)
internal val launchWidgetExpandedSize = DpSize(260.dp, 150.dp)

internal enum class LaunchWidgetLayout { Compact, Expanded }

internal const val QUICK_ACTION_DESTINATION_EXTRA = "com.nantty.android.widget.destination"
private val quickActionDestinationParameter = ActionParameters.Key<String>(QUICK_ACTION_DESTINATION_EXTRA)

internal enum class QuickActionDestination(val routeKey: String, val label: String) {
    Feed("feed", "Feed"),
    NewPost("new-post", "New post"),
    Wallet("wallet", "Wallet"),
    Messages("messages", "Messages"),
}

internal fun quickActionDestination(routeKey: String?): QuickActionDestination? =
    QuickActionDestination.entries.firstOrNull { it.routeKey == routeKey }

internal fun quickActionsForLayout(layout: LaunchWidgetLayout): List<QuickActionDestination> = when (layout) {
    LaunchWidgetLayout.Compact -> listOf(
        QuickActionDestination.Feed,
        QuickActionDestination.Wallet,
        QuickActionDestination.Messages,
    )
    LaunchWidgetLayout.Expanded -> QuickActionDestination.entries
}

internal fun launchWidgetLayoutForSize(size: DpSize): LaunchWidgetLayout =
    if (size.width >= launchWidgetExpandedSize.width && size.height >= launchWidgetExpandedSize.height) {
        LaunchWidgetLayout.Expanded
    } else {
        LaunchWidgetLayout.Compact
    }

private val launchWidgetColors by lazy {
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

class NanttyWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(setOf(launchWidgetCompactSize, launchWidgetExpandedSize))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            GlanceTheme(colors = launchWidgetColors) {
                LaunchWidgetContent()
            }
        }
    }
}

class NanttyWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = NanttyWidget()
}

@Composable
private fun LaunchWidgetContent() {
    val expanded = launchWidgetLayoutForSize(LocalSize.current) == LaunchWidgetLayout.Expanded
    val destinations = quickActionsForLayout(if (expanded) LaunchWidgetLayout.Expanded else LaunchWidgetLayout.Compact)
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(GlanceTheme.colors.surface)
            .cornerRadius(24.dp)
            .padding(horizontal = if (expanded) 18.dp else 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.Vertical.CenterVertically,
        horizontalAlignment = Alignment.Horizontal.Start,
    ) {
        Row(verticalAlignment = Alignment.Vertical.CenterVertically) {
            Image(
                provider = ImageProvider(R.drawable.ic_nantty),
                contentDescription = null,
                modifier = GlanceModifier.size(22.dp),
            )
            Text(
                "Quick actions",
                modifier = GlanceModifier.padding(start = 8.dp),
                style = TextStyle(color = GlanceTheme.colors.onSurface, fontSize = 14.sp, fontWeight = FontWeight.Bold),
            )
        }
        Spacer(GlanceModifier.height(6.dp))
        if (expanded) {
            ActionRow(destinations.take(2), tileWidth = 102.dp, gap = 8.dp)
            Spacer(GlanceModifier.height(6.dp))
            ActionRow(destinations.drop(2), tileWidth = 102.dp, gap = 8.dp)
        } else {
            ActionRow(destinations, tileWidth = 48.dp, gap = 3.dp)
        }
    }
}

@Composable
private fun ActionRow(destinations: List<QuickActionDestination>, tileWidth: Dp, gap: Dp) {
    Row(verticalAlignment = Alignment.Vertical.CenterVertically) {
        destinations.forEachIndexed { index, destination ->
            if (index > 0) Spacer(GlanceModifier.width(gap))
            ActionTile(destination, tileWidth)
        }
    }
}

@Composable
private fun ActionTile(destination: QuickActionDestination, width: Dp) {
    Column(
        modifier = GlanceModifier
            .width(width)
            .height(36.dp)
            .background(GlanceTheme.colors.surfaceVariant)
            .cornerRadius(14.dp)
            .clickable(
                actionStartActivity<MainActivity>(
                    actionParametersOf(quickActionDestinationParameter to destination.routeKey),
                ),
            )
            .padding(horizontal = 3.dp, vertical = 8.dp),
        verticalAlignment = Alignment.Vertical.CenterVertically,
        horizontalAlignment = Alignment.Horizontal.CenterHorizontally,
    ) {
        Text(
            destination.label,
            maxLines = 1,
            style = TextStyle(
                color = GlanceTheme.colors.onSurface,
                fontSize = if (width < 60.dp) 9.sp else 12.sp,
                fontWeight = FontWeight.Medium,
            ),
        )
    }
}
