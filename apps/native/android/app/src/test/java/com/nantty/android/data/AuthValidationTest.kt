package com.nantty.android.data

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthValidationTest {
    @Test
    fun emailOtpAndUsernameMatchReactNativeInputRules() {
        assertTrue(AuthValidation.isValidEmail(" person@example.ng "))
        assertFalse(AuthValidation.isValidEmail("not-an-email"))
        assertTrue(AuthValidation.isValidOtp("123456"))
        assertFalse(AuthValidation.isValidOtp("12-456"))
        assertTrue(AuthValidation.isValidUsername("user.name_2"))
        assertFalse(AuthValidation.isValidUsername("ab"))
        assertFalse(AuthValidation.isValidUsername("has space"))
    }

    @Test
    fun passwordMustMeetEachClientRequirement() {
        assertTrue(AuthValidation.meetsPasswordPolicy("market#42"))
        assertFalse(AuthValidation.meetsPasswordPolicy("market42"))
        assertFalse(AuthValidation.meetsPasswordPolicy("Short#2"))
        assertFalse(AuthValidation.meetsPasswordPolicy("long-password#1234567890"))
    }

    @Test
    fun birthdayUsesRealDateAndAgeBoundaries() {
        val today = LocalDate.of(2026, 11, 4)
        assertEquals("2013-11-04", AuthValidation.validBirthdayIso("04/11/2013", today))
        assertEquals(null, AuthValidation.validBirthdayIso("05/11/2013", today))
        assertEquals(null, AuthValidation.validBirthdayIso("31/02/2000", today))
        assertEquals(null, AuthValidation.validBirthdayIso("04/11/1900", today))
    }

    @Test
    fun birthdayInputFormatsDigitsWithoutAcceptingUnexpectedCharacters() {
        assertEquals("01/02/2000", AuthValidation.formatBirthdayInput("0102-2000"))
        assertEquals("31/12", AuthValidation.formatBirthdayInput("3112"))
        assertEquals("", AuthValidation.formatBirthdayInput("１２ab"))
    }
}
