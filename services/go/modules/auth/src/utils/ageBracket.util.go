package utils

import "time"

const adultAgeInYears = 18

func AgeBracketFromBirthday(birthday *time.Time, now time.Time) string {
	if birthday == nil || birthday.IsZero() {
		return "unknown"
	}
	adultFrom := birthday.AddDate(adultAgeInYears, 0, 0)
	if now.Before(adultFrom) {
		return "minor"
	}
	return "adult"
}
