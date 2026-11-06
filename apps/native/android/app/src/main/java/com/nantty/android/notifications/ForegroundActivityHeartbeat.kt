package com.nantty.android.notifications

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
import com.nantty.android.data.AccountSessionRepository
import com.nantty.android.data.ActivityHeartbeatRepository
import kotlinx.coroutines.delay
import java.util.concurrent.Executor

internal const val ACTIVITY_HEARTBEAT_INTERVAL_MILLIS = 15 * 60 * 1000L

/** Monotonic interval gate; lifecycle transitions do not reset the last successful scheduling time. */
internal class ActivityHeartbeatThrottle(
    private val intervalMillis: Long = ACTIVITY_HEARTBEAT_INTERVAL_MILLIS,
) {
    private var lastScheduledAt: Long? = null

    init {
        require(intervalMillis > 0)
    }

    fun shouldSchedule(nowMillis: Long): Boolean =
        lastScheduledAt == null || nowMillis - lastScheduledAt!! >= intervalMillis

    fun markScheduled(nowMillis: Long) {
        lastScheduledAt = nowMillis
    }

    fun delayUntilNext(nowMillis: Long): Long =
        lastScheduledAt?.let { (intervalMillis - (nowMillis - it)).coerceAtLeast(1L) } ?: 0L
}

@Composable
internal fun ForegroundActivityHeartbeat(
    enabled: Boolean,
    sessionRepository: AccountSessionRepository,
    executor: Executor,
) {
    val lifecycleOwner = LocalLifecycleOwner.current
    var resumed by remember(lifecycleOwner) {
        mutableStateOf(lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED))
    }
    val throttle = remember(sessionRepository) { ActivityHeartbeatThrottle() }

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

    LaunchedEffect(enabled, resumed, sessionRepository, executor) {
        if (!enabled || !resumed) return@LaunchedEffect
        while (true) {
            val now = SystemClock.elapsedRealtime()
            if (throttle.shouldSchedule(now)) {
                throttle.markScheduled(now)
                executor.execute {
                    ActivityHeartbeatRepository(
                        sessionProvider = sessionRepository::sessionOrNull,
                        refreshSessionProvider = sessionRepository::refreshSession,
                    ).recordCurrentActivity()
                }
            }
            delay(throttle.delayUntilNext(now).takeIf { it > 0L } ?: ACTIVITY_HEARTBEAT_INTERVAL_MILLIS)
        }
    }
}
