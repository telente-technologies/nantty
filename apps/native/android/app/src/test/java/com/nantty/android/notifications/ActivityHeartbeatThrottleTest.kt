package com.nantty.android.notifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ActivityHeartbeatThrottleTest {
    @Test
    fun schedulesImmediatelyThenNoMoreOftenThanInterval() {
        val throttle = ActivityHeartbeatThrottle()

        assertTrue(throttle.shouldSchedule(10_000L))
        throttle.markScheduled(10_000L)
        assertFalse(throttle.shouldSchedule(10_000L + ACTIVITY_HEARTBEAT_INTERVAL_MILLIS - 1))
        assertTrue(throttle.shouldSchedule(10_000L + ACTIVITY_HEARTBEAT_INTERVAL_MILLIS))
    }

    @Test
    fun foregroundReentryWaitsForRemainingIntervalAndThenSchedules() {
        val throttle = ActivityHeartbeatThrottle()
        throttle.markScheduled(5_000L)
        val reenteredAt = 5_000L + 4 * 60 * 1000L

        assertFalse(throttle.shouldSchedule(reenteredAt))
        assertEquals(11 * 60 * 1000L, throttle.delayUntilNext(reenteredAt))
        assertTrue(throttle.shouldSchedule(reenteredAt + throttle.delayUntilNext(reenteredAt)))
    }
}
