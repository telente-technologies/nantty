package com.nantty.android.data

data class GetVerifiedCardHistory(
    val lastImpressionAt: Long? = null,
    val dismissalsSinceSnooze: Int = 0,
    val snoozedUntil: Long? = null,
    val neverShowAgain: Boolean = false,
)

/** Frequency policy mirrored from React Native's getVerifiedCardFrequency utilities. */
internal object GetVerifiedCardFrequency {
    const val IMPRESSION_INTERVAL_DAYS = 3
    const val DISMISSALS_BEFORE_SNOOZE = 2
    const val SNOOZE_DAYS = 30
    const val MILLIS_PER_DAY = 86_400_000L

    fun canShow(history: GetVerifiedCardHistory, nowMillis: Long): Boolean {
        if (history.neverShowAgain || (history.snoozedUntil?.let { nowMillis < it } == true)) return false
        val lastImpression = history.lastImpressionAt ?: return true
        return nowMillis - lastImpression >= IMPRESSION_INTERVAL_DAYS * MILLIS_PER_DAY
    }

    fun recordImpression(history: GetVerifiedCardHistory, nowMillis: Long) = history.copy(lastImpressionAt = nowMillis)

    fun recordDismissal(history: GetVerifiedCardHistory, nowMillis: Long): GetVerifiedCardHistory {
        val dismissals = history.dismissalsSinceSnooze + 1
        return if (dismissals >= DISMISSALS_BEFORE_SNOOZE) {
            history.copy(
                lastImpressionAt = nowMillis,
                dismissalsSinceSnooze = 0,
                snoozedUntil = nowMillis + SNOOZE_DAYS * MILLIS_PER_DAY,
            )
        } else {
            history.copy(lastImpressionAt = nowMillis, dismissalsSinceSnooze = dismissals)
        }
    }

    fun neverShowAgain(history: GetVerifiedCardHistory) = history.copy(neverShowAgain = true)
}
