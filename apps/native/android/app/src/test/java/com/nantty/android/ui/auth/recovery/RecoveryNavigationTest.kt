package com.nantty.android.ui.auth.recovery

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class RecoveryNavigationTest {
    @Test
    fun backFromNewPasswordReturnsToOtpBeforeEmailEntry() {
        assertEquals(RecoveryStep.Code, recoveryPreviousStep(RecoveryStep.NewPassword))
        assertEquals(RecoveryStep.Email, recoveryPreviousStep(RecoveryStep.Code))
        assertNull(recoveryPreviousStep(RecoveryStep.Email))
    }
}
