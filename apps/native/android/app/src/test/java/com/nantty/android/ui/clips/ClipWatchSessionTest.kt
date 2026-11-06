package com.nantty.android.ui.clips

import org.junit.Assert.assertEquals
import org.junit.Test

class ClipWatchSessionTest {
    @Test
    fun countsNaturalPlaybackProgressAndIgnoresSeekDiscontinuities() {
        val session = ClipWatchSession()
        session.advance(0.0, 20.0)
        session.advance(1.0, 20.0)
        session.advance(2.0, 20.0)
        session.markSeek(10.0)
        session.advance(2.25, 20.0) // stale pre-seek sample
        session.advance(10.0, 20.0) // seek landed; not counted
        session.advance(11.0, 20.0)

        val summary = session.summary(0.0)
        assertEquals(3_000, summary.watchMs)
        assertEquals(20_000, summary.durationMs)
        assertEquals(0.55, summary.watchFraction, 0.0001)
        assertEquals(0, summary.loopCount)
    }

    @Test
    fun countsNaturalLoopWrapWithoutCountingLargeForwardJump() {
        val session = ClipWatchSession()
        session.advance(0.0, 10.0)
        session.advance(2.0, 10.0)
        session.advance(9.0, 10.0) // discontinuity is ignored
        session.advance(9.5, 10.0)
        session.advance(0.25, 10.0) // natural end-to-start wrap

        val summary = session.summary(0.0)
        assertEquals(3_250, summary.watchMs)
        assertEquals(1, summary.loopCount)
        assertEquals(1.0, summary.watchFraction, 0.0001)
    }
}
