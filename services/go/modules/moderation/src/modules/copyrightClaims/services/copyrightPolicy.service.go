package services

import (
	"regexp"
	"slices"
	"time"
)

const (
	CounterNoticeRestoreBusinessDays = 10
	MaximumClaimsPerHour             = 10
)

var emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`)

var workTypes = []string{"sound", "video", "image", "text"}

func IsValidEmail(candidate string) bool {
	return len(candidate) <= 254 && emailPattern.MatchString(candidate)
}

func WorkTypeFor(targetType, declared string) string {
	if slices.Contains(workTypes, declared) {
		return declared
	}
	if targetType == "sound" {
		return "sound"
	}
	return "video"
}

func AddBusinessDays(start time.Time, days int) time.Time {
	current := start
	for added := 0; added < days; {
		current = current.AddDate(0, 0, 1)
		if weekday := current.Weekday(); weekday != time.Saturday && weekday != time.Sunday {
			added++
		}
	}
	return current
}

var reviewableStatuses = []string{"pending", "needs_info"}

func CanDecide(status string) bool {
	return slices.Contains(reviewableStatuses, status)
}

func CanRequestInfo(status string) bool {
	return status == "pending"
}

func OpenStatuses() []string {
	return []string{"pending", "needs_info", "counter_notice"}
}
