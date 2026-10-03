package services

import "time"

const sendHourUtc = 6

var scheduledFrequencies = map[string]bool{"daily": true, "weekly": true, "monthly": true}

func IsKnownFrequency(frequency string) bool { return scheduledFrequencies[frequency] }

// NextSendAfter returns the next 06:00 UTC slot: tomorrow, next Monday, or the 1st of next month.
func NextSendAfter(frequency string, after time.Time) time.Time {
	day := time.Date(after.Year(), after.Month(), after.Day(), sendHourUtc, 0, 0, 0, time.UTC)
	switch frequency {
	case "weekly":
		day = day.AddDate(0, 0, 1)
		for day.Weekday() != time.Monday {
			day = day.AddDate(0, 0, 1)
		}
		return day
	case "monthly":
		return time.Date(after.Year(), after.Month()+1, 1, sendHourUtc, 0, 0, 0, time.UTC)
	}
	return day.AddDate(0, 0, 1)
}

// PeriodFor returns the inclusive date range a send at dueAt reports on: yesterday, the last 7 days, or last calendar month.
func PeriodFor(frequency string, dueAt time.Time) (from, to string) {
	const layout = "2006-01-02"
	yesterday := time.Date(dueAt.Year(), dueAt.Month(), dueAt.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -1)
	switch frequency {
	case "weekly":
		return yesterday.AddDate(0, 0, -6).Format(layout), yesterday.Format(layout)
	case "monthly":
		first := time.Date(dueAt.Year(), dueAt.Month()-1, 1, 0, 0, 0, 0, time.UTC)
		return first.Format(layout), first.AddDate(0, 1, -1).Format(layout)
	}
	return yesterday.Format(layout), yesterday.Format(layout)
}
