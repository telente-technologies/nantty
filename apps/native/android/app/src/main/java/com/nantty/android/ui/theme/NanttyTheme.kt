package com.nantty.android.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val NanttyBlue = Color(0xFF2043F5)
private val LightColors = lightColorScheme(
    primary = NanttyBlue,
    onPrimary = Color.White,
    background = Color(0xFFF8F9FC),
    surface = Color.White,
    onSurface = Color(0xFF171923),
    secondary = Color(0xFF586174),
)
private val DarkColors = darkColorScheme(
    primary = Color(0xFF9AA9FF),
    onPrimary = Color(0xFF101A58),
    background = Color(0xFF101116),
    surface = Color(0xFF191A21),
    onSurface = Color(0xFFF0F0F6),
    secondary = Color(0xFFB8BBC8),
)

@Composable
fun NanttyTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (androidx.compose.foundation.isSystemInDarkTheme()) DarkColors else LightColors, content = content)
}
