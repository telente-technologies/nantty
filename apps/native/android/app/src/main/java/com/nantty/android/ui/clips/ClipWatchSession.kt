package com.nantty.android.ui.clips

import com.nantty.android.data.ClipWatchSummary

/** Playback accounting mirrors RN: ignore seek discontinuities and include natural loop wraps. */
internal class ClipWatchSession {
    private var watchedSeconds = 0.0
    private var lastSeconds: Double? = null
    private var furthestSeconds = 0.0
    private var observedDurationSeconds = 0.0
    private var loops = 0
    private var seekTargetSeconds: Double? = null
    private var samplesSinceSeek = 0

    fun reset() {
        watchedSeconds = 0.0
        lastSeconds = null
        furthestSeconds = 0.0
        observedDurationSeconds = 0.0
        loops = 0
        seekTargetSeconds = null
        samplesSinceSeek = 0
    }

    fun markSeek(targetSeconds: Double) {
        lastSeconds = null
        seekTargetSeconds = targetSeconds.takeIf(Double::isFinite)?.coerceAtLeast(0.0)
        samplesSinceSeek = 0
    }

    fun advance(currentSeconds: Double, durationSeconds: Double) {
        if (!currentSeconds.isFinite() || currentSeconds < 0.0) return
        if (durationSeconds.isFinite() && durationSeconds > 0.0) observedDurationSeconds = durationSeconds
        val target = seekTargetSeconds
        if (target != null) {
            samplesSinceSeek += 1
            val landed = kotlin.math.abs(currentSeconds - target) <= SEEK_LANDING_TOLERANCE_SECONDS
            if (!landed && samplesSinceSeek < MAXIMUM_SAMPLES_BEFORE_SEEK_LANDS) return
            seekTargetSeconds = null
        }
        val previous = lastSeconds
        if (previous != null) {
            val step = currentSeconds - previous
            if (step > 0.0 && step <= MAXIMUM_NATURAL_STEP_SECONDS) watchedSeconds += step
            val wrapped = step < 0.0 && durationSeconds > 0.0 &&
                previous >= durationSeconds * LOOP_END_FRACTION && currentSeconds <= durationSeconds * LOOP_START_FRACTION
            if (wrapped) {
                loops += 1
                watchedSeconds += (durationSeconds - previous).coerceAtLeast(0.0) + currentSeconds
            }
        }
        lastSeconds = currentSeconds
        furthestSeconds = maxOf(furthestSeconds, currentSeconds)
    }

    fun summary(fallbackDurationSeconds: Double): ClipWatchSummary {
        val durationSeconds = observedDurationSeconds.takeIf { it > 0.0 } ?: fallbackDurationSeconds
        val fraction = if (loops > 0) 1.0 else if (durationSeconds > 0.0) (furthestSeconds / durationSeconds).coerceAtMost(1.0) else 0.0
        return ClipWatchSummary(
            watchMs = (watchedSeconds * 1000.0).toLong().coerceIn(0, MAXIMUM_MILLISECONDS).toInt(),
            durationMs = (durationSeconds.coerceAtLeast(0.0) * 1000.0).toLong().coerceIn(0, MAXIMUM_MILLISECONDS).toInt(),
            watchFraction = (kotlin.math.round(fraction * 1000.0) / 1000.0),
            loopCount = loops.coerceAtMost(MAXIMUM_LOOPS),
        )
    }

    private companion object {
        const val MAXIMUM_NATURAL_STEP_SECONDS = 3.0
        const val LOOP_END_FRACTION = 0.8
        const val LOOP_START_FRACTION = 0.2
        const val SEEK_LANDING_TOLERANCE_SECONDS = 1.0
        const val MAXIMUM_SAMPLES_BEFORE_SEEK_LANDS = 8
        const val MAXIMUM_MILLISECONDS = 3_600_000L
        const val MAXIMUM_LOOPS = 100
    }
}
