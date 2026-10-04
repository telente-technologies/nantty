package utils

import (
	"testing"
	"time"
)

func date(value string) *time.Time {
	parsed, _ := time.Parse(time.DateOnly, value)
	return &parsed
}

func instant(value string) time.Time {
	parsed, _ := time.Parse(time.RFC3339, value)
	return parsed
}

func TestBirthdayAtMidnightUtcFollowsTheUsersOwnTimezone(t *testing.T) {
	born := date("2000-10-04")
	joined := instant("2024-01-10T12:00:00Z")
	cases := []struct {
		name, timezone, now string
		want                bool
	}{
		{"lagos just after local midnight", "Africa/Lagos", "2026-10-03T23:30:00Z", true},
		{"lagos the evening before", "Africa/Lagos", "2026-10-03T22:30:00Z", false},
		{"london bst just after local midnight", "Europe/London", "2026-10-03T23:30:00Z", true},
		{"london bst before local midnight", "Europe/London", "2026-10-03T22:59:00Z", false},
		{"los angeles still the day before", "America/Los_Angeles", "2026-10-04T05:00:00Z", false},
		{"los angeles on the day", "America/Los_Angeles", "2026-10-04T08:00:00Z", true},
		{"los angeles end of the day", "America/Los_Angeles", "2026-10-05T06:59:00Z", true},
		{"unknown timezone falls back to utc", "Mars/Olympus", "2026-10-04T00:00:00Z", true},
	}
	for _, tc := range cases {
		got := ComputeCelebrationDay(born, joined, tc.timezone, instant(tc.now))
		if got.Birthday != tc.want {
			t.Errorf("%s: birthday=%v want %v", tc.name, got.Birthday, tc.want)
		}
		if tc.want && got.Age != 26 {
			t.Errorf("%s: age=%d want 26", tc.name, got.Age)
		}
	}
}

func TestLeapDayBirthdayIsCelebratedOnFebruary28InCommonYears(t *testing.T) {
	born := date("2000-02-29")
	joined := instant("2010-05-05T00:00:00Z")
	if got := ComputeCelebrationDay(born, joined, "UTC", instant("2027-02-28T10:00:00Z")); !got.Birthday || got.Age != 27 {
		t.Fatalf("common year feb 28: %+v", got)
	}
	if got := ComputeCelebrationDay(born, joined, "UTC", instant("2027-03-01T10:00:00Z")); got.Birthday {
		t.Fatalf("march 1 must not celebrate: %+v", got)
	}
	if got := ComputeCelebrationDay(born, joined, "UTC", instant("2028-02-28T10:00:00Z")); got.Birthday {
		t.Fatalf("leap year feb 28 waits for feb 29: %+v", got)
	}
	if got := ComputeCelebrationDay(born, joined, "UTC", instant("2028-02-29T10:00:00Z")); !got.Birthday || got.Age != 28 {
		t.Fatalf("leap year feb 29: %+v", got)
	}
}

func TestBirthdayNeverFiresInTheBirthYearOrWithoutADate(t *testing.T) {
	joined := instant("2024-01-10T12:00:00Z")
	if got := ComputeCelebrationDay(date("2026-10-04"), joined, "UTC", instant("2026-10-04T10:00:00Z")); got.Birthday {
		t.Fatalf("birth year: %+v", got)
	}
	if got := ComputeCelebrationDay(nil, joined, "UTC", instant("2026-10-04T10:00:00Z")); got.Birthday || got.Age != 0 {
		t.Fatalf("no birthday: %+v", got)
	}
}

func TestAnniversaryUsesTheJoinDateInTheUsersTimezone(t *testing.T) {
	joined := instant("2024-10-03T23:30:00Z")
	if got := ComputeCelebrationDay(nil, joined, "Africa/Lagos", instant("2026-10-04T10:00:00Z")); !got.Anniversary || got.AnniversaryYears != 2 {
		t.Fatalf("joined late evening UTC is Oct 4 in Lagos: %+v", got)
	}
	if got := ComputeCelebrationDay(nil, joined, "UTC", instant("2026-10-04T10:00:00Z")); got.Anniversary {
		t.Fatalf("UTC joined Oct 3: %+v", got)
	}
	if got := ComputeCelebrationDay(nil, joined, "UTC", instant("2024-10-03T23:45:00Z")); got.Anniversary {
		t.Fatalf("first year is not an anniversary: %+v", got)
	}
	leap := instant("2024-02-29T08:00:00Z")
	if got := ComputeCelebrationDay(nil, leap, "UTC", instant("2027-02-28T08:00:00Z")); !got.Anniversary || got.AnniversaryYears != 3 {
		t.Fatalf("leap-day join in a common year: %+v", got)
	}
}
