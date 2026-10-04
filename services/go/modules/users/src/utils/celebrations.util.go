package utils

import "time"

type CelebrationDay struct {
	LocalDate        string
	Birthday         bool
	Age              int
	Anniversary      bool
	AnniversaryYears int
}

func LoadCelebrationLocation(name string) *time.Location {
	if name == "" {
		return time.UTC
	}
	location, err := time.LoadLocation(name)
	if err != nil {
		return time.UTC
	}
	return location
}

func IsValidTimezone(name string) bool {
	if name == "" || len(name) > 64 {
		return false
	}
	_, err := time.LoadLocation(name)
	return err == nil
}

func isLeapYear(year int) bool {
	return year%4 == 0 && (year%100 != 0 || year%400 == 0)
}

func anniversaryFallsOn(month time.Month, day int, localYear int, localMonth time.Month, localDay int) bool {
	if month == localMonth && day == localDay {
		return true
	}
	return month == time.February && day == 29 && !isLeapYear(localYear) && localMonth == time.February && localDay == 28
}

func ComputeCelebrationDay(birthday *time.Time, joinedAt time.Time, timezone string, now time.Time) CelebrationDay {
	location := LoadCelebrationLocation(timezone)
	local := now.In(location)
	year, month, day := local.Date()
	result := CelebrationDay{LocalDate: local.Format(time.DateOnly)}
	if birthday != nil && !birthday.IsZero() {
		born := birthday.UTC()
		if age := year - born.Year(); age > 0 && anniversaryFallsOn(born.Month(), born.Day(), year, month, day) {
			result.Birthday, result.Age = true, age
		}
	}
	joined := joinedAt.In(location)
	if years := year - joined.Year(); years >= 1 && anniversaryFallsOn(joined.Month(), joined.Day(), year, month, day) {
		result.Anniversary, result.AnniversaryYears = true, years
	}
	return result
}

func LocalHour(now time.Time, timezone string) int {
	return now.In(LoadCelebrationLocation(timezone)).Hour()
}
