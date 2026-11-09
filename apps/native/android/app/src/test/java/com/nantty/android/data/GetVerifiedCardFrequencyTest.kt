package com.nantty.android.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GetVerifiedCardFrequencyTest {
    @Test
    fun firstImpressionIsAllowedAndNextIsSuppressedForThreeDays() {
        val now = 1_800_000_000_000L
        val afterImpression = GetVerifiedCardFrequency.recordImpression(GetVerifiedCardHistory(), now)

        assertTrue(GetVerifiedCardFrequency.canShow(GetVerifiedCardHistory(), now))
        assertFalse(GetVerifiedCardFrequency.canShow(afterImpression, now + 1))
        assertTrue(GetVerifiedCardFrequency.canShow(afterImpression, now + 3 * GetVerifiedCardFrequency.MILLIS_PER_DAY))
    }

    @Test
    fun secondDismissalSnoozesForThirtyDaysAndResetsDismissalCount() {
        val now = 1_800_000_000_000L
        val first = GetVerifiedCardFrequency.recordDismissal(GetVerifiedCardHistory(), now)
        val secondAt = now + 3 * GetVerifiedCardFrequency.MILLIS_PER_DAY
        val second = GetVerifiedCardFrequency.recordDismissal(first, secondAt)

        assertEquals(1, first.dismissalsSinceSnooze)
        assertEquals(0, second.dismissalsSinceSnooze)
        assertEquals(secondAt + 30 * GetVerifiedCardFrequency.MILLIS_PER_DAY, second.snoozedUntil)
        assertFalse(GetVerifiedCardFrequency.canShow(second, secondAt + 29 * GetVerifiedCardFrequency.MILLIS_PER_DAY))
        assertTrue(GetVerifiedCardFrequency.canShow(second, secondAt + 30 * GetVerifiedCardFrequency.MILLIS_PER_DAY))
    }

    @Test
    fun permanentHideSurvivesAnyElapsedInterval() {
        val hidden = GetVerifiedCardFrequency.neverShowAgain(GetVerifiedCardHistory())

        assertFalse(GetVerifiedCardFrequency.canShow(hidden, Long.MAX_VALUE))
    }
}
