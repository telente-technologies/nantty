package com.nantty.android.data

import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.ResolverStyle
import java.time.format.DateTimeParseException

object AuthValidation {
    const val MINIMUM_ACCOUNT_AGE_YEARS = 13
    const val MINIMUM_PASSWORD_LENGTH = 8
    const val MAXIMUM_PASSWORD_LENGTH = 20
    const val OTP_CODE_LENGTH = 6
    const val OTP_RESEND_COOLDOWN_SECONDS = 60
    const val MINIMUM_USERNAME_LENGTH = 3
    const val MAXIMUM_USERNAME_LENGTH = 20
    const val MINIMUM_PERSONALIZATION_TOPICS = 3
    private val birthdayInputFormatter = DateTimeFormatter.ofPattern("dd/MM/uuuu").withResolverStyle(ResolverStyle.STRICT)

    fun isValidEmail(value: String): Boolean = EMAIL_PATTERN.matches(value.trim())

    fun isValidOtp(value: String): Boolean = value.length == OTP_CODE_LENGTH && value.all { it in '0'..'9' }

    fun isValidUsername(value: String): Boolean = USERNAME_PATTERN.matches(value)

    fun formatBirthdayInput(value: String): String {
        val digits = value.filter { it in '0'..'9' }.take(8)
        return buildString {
            append(digits.take(2))
            if (digits.length > 2) append('/').append(digits.substring(2, minOf(4, digits.length)))
            if (digits.length > 4) append('/').append(digits.substring(4))
        }
    }

    fun meetsPasswordPolicy(value: String): Boolean =
        value.length in MINIMUM_PASSWORD_LENGTH..MAXIMUM_PASSWORD_LENGTH &&
        value.any(::isAsciiLetter) && value.any { it in '0'..'9' } && value.any { !isAsciiLetter(it) && it !in '0'..'9' && !it.isWhitespace() }

    /** Returns the ISO date expected by the registration endpoint or null when invalid/underage. */
    fun validBirthdayIso(value: String, today: LocalDate = LocalDate.now(ZoneOffset.UTC)): String? {
        val birthday = try {
            LocalDate.parse(value, birthdayInputFormatter)
        } catch (_: DateTimeParseException) {
            return null
        }
        val birthdayNotYetReached = today.monthValue < birthday.monthValue ||
            (today.monthValue == birthday.monthValue && today.dayOfMonth < birthday.dayOfMonth)
        val age = today.year - birthday.year - if (birthdayNotYetReached) 1 else 0
        return birthday.takeIf { age in MINIMUM_ACCOUNT_AGE_YEARS..120 && !it.isAfter(today) }?.toString()
    }

    private val EMAIL_PATTERN = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$")
    private val USERNAME_PATTERN = Regex("^[A-Za-z0-9_.]{$MINIMUM_USERNAME_LENGTH,$MAXIMUM_USERNAME_LENGTH}$")
    private fun isAsciiLetter(value: Char): Boolean = value in 'A'..'Z' || value in 'a'..'z'
}
