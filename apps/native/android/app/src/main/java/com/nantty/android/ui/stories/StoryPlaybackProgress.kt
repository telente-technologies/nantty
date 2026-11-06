package com.nantty.android.ui.stories

internal const val STORY_IMAGE_DURATION_MS = 5_000L
internal const val STORY_PROGRESS_TICK_MS = 50L

internal fun advanceStoryPlaybackProgress(progress: Float, elapsedMillis: Long): Float {
    if (!progress.isFinite()) return 0f
    if (elapsedMillis <= 0L) return progress.coerceIn(0f, 1f)
    return (progress.coerceIn(0f, 1f) + elapsedMillis.toFloat() / STORY_IMAGE_DURATION_MS).coerceAtMost(1f)
}

internal fun storyVideoPlaybackProgress(currentSeconds: Double, durationSeconds: Double): Float {
    if (!currentSeconds.isFinite() || !durationSeconds.isFinite() || durationSeconds <= 0.0) return 0f
    return (currentSeconds / durationSeconds).toFloat().coerceIn(0f, 1f)
}
