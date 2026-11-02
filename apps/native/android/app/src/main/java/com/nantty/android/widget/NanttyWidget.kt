package com.nantty.android.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.actionStartActivity
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.glance.unit.dp
import com.nantty.android.MainActivity

class NanttyWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent { WidgetContent() }
    }
}

class NanttyWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = NanttyWidget()
}

@Composable
private fun WidgetContent() {
    Column(
        modifier = GlanceModifier.fillMaxSize().background(ColorProvider(0xFF2043F5)).padding(18.dp)
            .clickable(actionStartActivity<MainActivity>()),
        verticalAlignment = Alignment.Vertical.CenterVertically,
        horizontalAlignment = Alignment.Horizontal.Start,
    ) {
        Text("nantty", style = TextStyle(color = ColorProvider(0xFFFFFFFF), fontWeight = FontWeight.Bold))
        Text("A little closer to your people.", style = TextStyle(color = ColorProvider(0xFFE2E7FF)))
        Text("Tap to open your feed  →", style = TextStyle(color = ColorProvider(0xFFFFFFFF)))
    }
}
