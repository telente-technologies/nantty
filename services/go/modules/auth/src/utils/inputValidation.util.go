package utils

import (
	authErrors "nantty/modules/auth/src/errors"

	"net/mail"
	"strings"
	"time"
	"unicode"
)

const (
	passwordMinimumLength    = 8
	passwordMaximumLength    = 128
	minimumAccountAgeInYears = 13
)

func NormalizeEmailAddress(raw string) (string, bool) {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	if len(trimmed) < 3 || len(trimmed) > 254 {
		return "", false
	}
	parsed, err := mail.ParseAddress(trimmed)
	if err != nil || parsed.Address != trimmed || !strings.Contains(trimmed[strings.LastIndex(trimmed, "@"):], ".") {
		return "", false
	}
	return trimmed, true
}

func AssertPasswordMeetsPolicy(password string) error {
	if len(password) < passwordMinimumLength || len(password) > passwordMaximumLength {
		return authErrors.Unprocessable("Passwords must be 8-128 characters long.")
	}
	hasLetter, hasDigit := false, false
	for _, character := range password {
		hasLetter = hasLetter || unicode.IsLetter(character)
		hasDigit = hasDigit || unicode.IsDigit(character)
	}
	if !hasLetter || !hasDigit {
		return authErrors.Unprocessable("Passwords must contain at least one letter and one number.")
	}
	return nil
}

func ParseBirthday(raw string, now time.Time) (time.Time, error) {
	birthday, err := time.Parse(time.DateOnly, raw)
	if err != nil {
		return time.Time{}, authErrors.Unprocessable("Enter your birthday as YYYY-MM-DD.")
	}
	now = now.UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	if birthday.After(today) || birthday.Before(time.Date(now.Year()-120, 1, 1, 0, 0, 0, 0, time.UTC)) {
		return time.Time{}, authErrors.Unprocessable("Enter a valid birthday.")
	}
	return birthday, nil
}

func IsBelowMinimumAccountAge(birthday time.Time, now time.Time) bool {
	now = now.UTC()
	cutoff := time.Date(now.Year()-minimumAccountAgeInYears, now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	return birthday.After(cutoff)
}

func ParseBirthdayAndAssertMinimumAge(raw string, now time.Time) (time.Time, error) {
	birthday, err := ParseBirthday(raw, now)
	if err != nil {
		return time.Time{}, err
	}
	if IsBelowMinimumAccountAge(birthday, now) {
		return time.Time{}, authErrors.ErrBelowMinimumAge
	}
	return birthday, nil
}
