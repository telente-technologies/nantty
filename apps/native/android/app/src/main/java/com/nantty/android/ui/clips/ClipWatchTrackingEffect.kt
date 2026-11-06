package com.nantty.android.ui.clips

import android.os.SystemClock
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.nantty.android.data.ClipFeedItem
import com.nantty.android.data.ClipWatchInteractionSession
import com.nantty.android.data.ClipWatchTrackingRepository
import kotlinx.coroutines.awaitCancellation
import java.util.concurrent.Executor

@Composable
internal fun ClipWatchTrackingEffect(
    item: ClipFeedItem,
    active: Boolean,
    repository: ClipWatchTrackingRepository,
    executor: Executor,
): (Double, Double) -> Unit {
    val lifecycleOwner = LocalLifecycleOwner.current
    var resumed by remember(lifecycleOwner) {
        mutableStateOf(lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED))
    }
    val watchSession = remember(item.post.id) { ClipWatchSession() }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> resumed = true
                Lifecycle.Event.ON_PAUSE, Lifecycle.Event.ON_STOP -> resumed = false
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(item.post.id, active, resumed) {
        if (!active || !resumed || !item.viewerHasAccess) return@LaunchedEffect
        watchSession.reset()
        val visibleSince = SystemClock.elapsedRealtime()
        try {
            awaitCancellation()
        } finally {
            val visibleMs = (SystemClock.elapsedRealtime() - visibleSince).coerceAtLeast(0L)
            if (visibleMs >= ClipWatchTrackingRepository.MINIMUM_VISIBLE_MS) {
                val event = ClipWatchInteractionSession(
                    postId = item.post.id,
                    authorId = item.post.authorId,
                    postedAsId = item.post.postedAsId,
                    visibleMs = visibleMs,
                    watch = watchSession.summary(item.durationSeconds.toDouble()),
                )
                executor.execute { repository.record(event) }
            }
        }
    }

    val currentlyTrackable = active && resumed && item.viewerHasAccess
    return remember(watchSession, currentlyTrackable) {
        if (currentlyTrackable) ({ current, duration -> watchSession.advance(current, duration) }) else ({ _, _ -> })
    }
}
