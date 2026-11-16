package utils_test

import (
	"testing"
	"time"

	"nantty/modules/auth/src/utils"
)

func TestAgeBracketFromBirthdayNeverExposesTheDate(t *testing.T) {
	now := time.Date(2026, 10, 4, 12, 0, 0, 0, time.UTC)
	eighteenToday := time.Date(2008, 10, 4, 0, 0, 0, 0, time.UTC)
	eighteenTomorrow := time.Date(2008, 10, 5, 0, 0, 0, 0, time.UTC)
	cases := map[string]struct {
		birthday *time.Time
		want     string
	}{
		"missing birthday":  {nil, "unknown"},
		"turns 18 today":    {&eighteenToday, "adult"},
		"turns 18 tomorrow": {&eighteenTomorrow, "minor"},
	}
	for name, testCase := range cases {
		if got := utils.AgeBracketFromBirthday(testCase.birthday, now); got != testCase.want {
			t.Fatalf("%s: got %q, want %q", name, got, testCase.want)
		}
	}
}
