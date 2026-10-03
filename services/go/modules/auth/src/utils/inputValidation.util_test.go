package utils

import (
	"testing"
	"time"
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
		got, valid := NormalizeEmailAddress(testCase.raw)
		if got != testCase.want || valid != testCase.valid {
			t.Fatalf("%q -> %q %v", testCase.raw, got, valid)
		}
	}
}

func TestAssertPasswordMeetsPolicy(t *testing.T) {
	cases := map[string]bool{"short1": false, "lettersonly": false, "12345678": false, "goodpass1": true, "ünïcode99": true}
	for password, valid := range cases {
		if (AssertPasswordMeetsPolicy(password) == nil) != valid {
			t.Fatalf("%q valid=%v", password, !valid)
		}
	}
}

func TestParseBirthdayAndAssertMinimumAge(t *testing.T) {
	now := time.Date(2026, 10, 3, 12, 0, 0, 0, time.UTC)
	cases := map[string]bool{"2013-10-03": true, "2013-10-04": false, "1990-02-30": false, "03/10/1990": false, "1800-01-01": false}
	for raw, valid := range cases {
		if _, err := ParseBirthdayAndAssertMinimumAge(raw, now); (err == nil) != valid {
			t.Fatalf("%q valid=%v err=%v", raw, valid, err)
		}
	}
}
