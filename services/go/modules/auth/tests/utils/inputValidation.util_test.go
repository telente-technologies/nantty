package utils_test

import (
	"testing"
	"time"

	"nantty/modules/auth/src/utils"
)

func TestNormalizeEmailAddress(t *testing.T) {
	cases := []struct {
		raw   string
		want  string
		valid bool
	}{
		{"  Ada@Example.COM ", "ada@example.com", true},
		{"ada@example", "", false},
		{"Ada Lovelace <ada@example.com>", "", false},
		{"not-an-email", "", false},
	}
	for _, testCase := range cases {
		got, valid := utils.NormalizeEmailAddress(testCase.raw)
		if got != testCase.want || valid != testCase.valid {
			t.Fatalf("%q -> %q %v", testCase.raw, got, valid)
		}
	}
}

func TestAssertPasswordMeetsPolicy(t *testing.T) {
	cases := map[string]bool{"short1": false, "lettersonly": false, "12345678": false, "goodpass1": true, "ünïcode99": true}
	for password, valid := range cases {
		if (utils.AssertPasswordMeetsPolicy(password) == nil) != valid {
			t.Fatalf("%q valid=%v", password, !valid)
		}
	}
}

func TestParseBirthdayAndAssertMinimumAge(t *testing.T) {
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	cases := map[string]bool{"2013-10-03": true, "2013-10-04": false, "1990-02-30": false, "03/10/1990": false, "1800-01-01": false}
	for raw, valid := range cases {
		if _, err := utils.ParseBirthdayAndAssertMinimumAge(raw, now); (err == nil) != valid {
			t.Fatalf("%q valid=%v err=%v", raw, valid, err)
		}
	}
}

func TestBirthdayEdgeCasesAroundTheThirteenthBirthdayAndMidnight(t *testing.T) {
	lateLagosEvening := time.Date(2026, 10, 3, 23, 30, 0, 0, time.FixedZone("WAT", 3600))
	cases := map[string]bool{"2013-10-03": false, "2013-10-04": true, "2013-10-02": false, "2012-02-29": false}
	for raw, below := range cases {
		birthday, err := utils.ParseBirthday(raw, lateLagosEvening)
		if err != nil {
			t.Fatalf("%q: %v", raw, err)
		}
		if utils.IsBelowMinimumAccountAge(birthday, lateLagosEvening) != below {
			t.Fatalf("%q below=%v", raw, !below)
		}
	}
	for _, raw := range []string{"2026-10-04", "2027-01-01", "1899-12-31", "2013-13-01", ""} {
		if _, err := utils.ParseBirthday(raw, lateLagosEvening); err == nil {
			t.Fatalf("%q must be rejected", raw)
		}
	}
	if _, err := utils.ParseBirthday("2026-10-03", lateLagosEvening); err != nil {
		t.Fatalf("today in UTC is a valid date: %v", err)
	}
}
