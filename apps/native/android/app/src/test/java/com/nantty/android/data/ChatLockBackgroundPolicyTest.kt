package com.nantty.android.data

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatLockBackgroundPolicyTest {
    @Test
    fun locksImmediatelyWhenZeroSecondsIsConfigured() {
        assertTrue(ChatLockBackgroundPolicy.shouldLock(true, 1_000L, 1_000L, 0))
    }

    @Test
    fun locksAtTheConfiguredThresholdButNotBeforeIt() {
        assertFalse(ChatLockBackgroundPolicy.shouldLock(true, 5_000L, 64_999L, 60))
        assertTrue(ChatLockBackgroundPolicy.shouldLock(true, 5_000L, 65_000L, 60))
    }

    @Test
    fun doesNotLockWithoutPasscodeOrForInvalidClockAndPreferenceValues() {
        assertFalse(ChatLockBackgroundPolicy.shouldLock(false, 0L, 60_000L, 60))
        assertFalse(ChatLockBackgroundPolicy.shouldLock(true, 10L, 9L, 0))
        assertFalse(ChatLockBackgroundPolicy.shouldLock(true, 0L, 60_000L, -1))
    }
}
