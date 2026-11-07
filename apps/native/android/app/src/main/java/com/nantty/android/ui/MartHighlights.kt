package com.nantty.android.ui

import android.content.Context
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import coil.compose.AsyncImage
import com.nantty.android.data.MartHighlight
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

internal const val MART_HIGHLIGHTS_AUTO_ADVANCE_MS = 5_000L

@Composable
internal fun MartHighlights(
    highlights: List<MartHighlight>,
    onOpen: (MartHighlight) -> Unit,
    onViewed: (MartHighlight) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (highlights.isEmpty()) return
    val pagerState = rememberPagerState(pageCount = { highlights.size })
    val current = highlights.getOrNull(pagerState.currentPage)
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    var isVisible by remember { mutableStateOf(false) }
    var isResumed by remember(lifecycleOwner) {
        mutableStateOf(lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED))
    }
    var touchExplorationEnabled by remember(context) {
        mutableStateOf(context.isTouchExplorationEnabled())
    }
    var animationsEnabled by remember(context) {
        mutableStateOf(context.areSystemAnimationsEnabled())
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> isResumed = true
                Lifecycle.Event.ON_PAUSE, Lifecycle.Event.ON_STOP -> isResumed = false
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    val accessibilityManager = remember(context) {
        context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
    }
    DisposableEffect(accessibilityManager) {
        val listener = AccessibilityManager.TouchExplorationStateChangeListener { enabled ->
            touchExplorationEnabled = enabled
        }
        accessibilityManager?.addTouchExplorationStateChangeListener(listener)
        onDispose { accessibilityManager?.removeTouchExplorationStateChangeListener(listener) }
    }
    DisposableEffect(context) {
        val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) {
                animationsEnabled = context.areSystemAnimationsEnabled()
            }
        }
        context.contentResolver.registerContentObserver(
            Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE),
            false,
            observer,
        )
        onDispose { context.contentResolver.unregisterContentObserver(observer) }
    }

    val autoAdvance = canAutoAdvanceMartHighlights(
        highlightCount = highlights.size,
        isVisible = isVisible,
        isResumed = isResumed,
        isScrolling = pagerState.isScrollInProgress,
        animationsEnabled = animationsEnabled,
        touchExplorationEnabled = touchExplorationEnabled,
    )
    LaunchedEffect(highlights.map(MartHighlight::id)) { pagerState.scrollToPage(0) }
    LaunchedEffect(autoAdvance, pagerState.currentPage, highlights.size) {
        if (!autoAdvance) return@LaunchedEffect
        delay(MART_HIGHLIGHTS_AUTO_ADVANCE_MS)
        if (!pagerState.isScrollInProgress && highlights.size > 1) {
            pagerState.animateScrollToPage((pagerState.currentPage + 1) % highlights.size)
        }
    }
    LaunchedEffect(current?.id) { current?.let(onViewed) }

    Column(
        modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)
            .onGloballyPositioned { coordinates ->
                val bounds = coordinates.boundsInWindow()
                val visibleHeight = (minOf(bounds.bottom, view.height.toFloat()) - maxOf(bounds.top, 0f)).coerceAtLeast(0f)
                val visibleWidth = (minOf(bounds.right, view.width.toFloat()) - maxOf(bounds.left, 0f)).coerceAtLeast(0f)
                val visibleArea = visibleHeight * visibleWidth
                val totalArea = bounds.width * bounds.height
                val nextVisible = totalArea > 0f && visibleArea / totalArea >= 0.5f
                if (nextVisible != isVisible) isVisible = nextVisible
            },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(end = 28.dp),
            pageSpacing = 10.dp,
        ) { page ->
            val highlight = highlights[page]
            val positionDescription = stringResource(
                com.nantty.android.R.string.mart_highlights_position,
                page + 1,
                highlights.size,
            )
            Card(
                onClick = { onOpen(highlight) },
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
                modifier = Modifier.fillMaxWidth().height(156.dp).semantics {
                    contentDescription = listOfNotNull(highlight.title, highlight.subtitle, highlight.sponsored?.label).joinToString(". ")
                    stateDescription = positionDescription
                },
            ) {
                Box(Modifier.fillMaxWidth().height(156.dp).background(MaterialTheme.colorScheme.surfaceContainerHighest)) {
                    highlight.imageUrl?.let { imageUrl ->
                        AsyncImage(
                            model = imageUrl,
                            contentDescription = null,
                            modifier = Modifier.matchParentSize().clip(RoundedCornerShape(18.dp)),
                            contentScale = ContentScale.Crop,
                        )
                    }
                    Column(
                        Modifier.align(Alignment.BottomStart).fillMaxWidth()
                            .background(MaterialTheme.colorScheme.scrim.copy(alpha = 0.66f))
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(highlight.title, color = MaterialTheme.colorScheme.inverseOnSurface, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        val caption = highlight.sponsored?.let { listOfNotNull(it.label, it.advertiserName, highlight.subtitle).filter(String::isNotBlank).joinToString(" · ") }
                            ?: listOfNotNull(highlight.subtitle, highlight.reasonLabel.takeIf(String::isNotBlank)).joinToString(" · ")
                        if (caption.isNotBlank()) Text(caption, color = MaterialTheme.colorScheme.inverseOnSurface, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
        if (highlights.size > 1) {
            val positionAccessibilityDescription = stringResource(
                com.nantty.android.R.string.mart_highlights_position_description,
                pagerState.currentPage + 1,
                highlights.size,
            )
            val nextAccessibilityAction = stringResource(com.nantty.android.R.string.mart_highlights_next)
            val previousAccessibilityAction = stringResource(com.nantty.android.R.string.mart_highlights_previous)
            Text(
                text = stringResource(
                    com.nantty.android.R.string.mart_highlights_position,
                    pagerState.currentPage + 1,
                    highlights.size,
                ),
                modifier = Modifier.align(Alignment.End).semantics {
                    contentDescription = positionAccessibilityDescription
                    customActions = listOf(
                        CustomAccessibilityAction(nextAccessibilityAction) {
                            scope.launch { pagerState.animateScrollToPage((pagerState.currentPage + 1) % highlights.size) }
                            true
                        },
                        CustomAccessibilityAction(previousAccessibilityAction) {
                            scope.launch { pagerState.animateScrollToPage((pagerState.currentPage - 1 + highlights.size) % highlights.size) }
                            true
                        },
                    )
                },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}

internal fun canAutoAdvanceMartHighlights(
    highlightCount: Int,
    isVisible: Boolean,
    isResumed: Boolean,
    isScrolling: Boolean,
    animationsEnabled: Boolean,
    touchExplorationEnabled: Boolean,
): Boolean = highlightCount > 1 && isVisible && isResumed && !isScrolling && animationsEnabled && !touchExplorationEnabled

private fun Context.isTouchExplorationEnabled(): Boolean =
    (getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager)?.isTouchExplorationEnabled == true

private fun Context.areSystemAnimationsEnabled(): Boolean =
    runCatching { Settings.Global.getFloat(contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) > 0f }
        .getOrDefault(true)
