package com.nantty.android.data

/** Mirrors React Native's elapsed-time chat auto-lock rule; the passcode itself stays device-local. */
internal object ChatLockBackgroundPolicy {
    fun shouldLock(
        isPasscodeSet: Boolean,
        backgroundedAtMillis: Long,
        resumedAtMillis: Long,
        autoLockSeconds: Int,
    ): Boolean {
        if (!isPasscodeSet || resumedAtMillis < backgroundedAtMillis || autoLockSeconds < 0) return false
        return resumedAtMillis - backgroundedAtMillis >= autoLockSeconds.toLong() * 1_000L
    }
}
