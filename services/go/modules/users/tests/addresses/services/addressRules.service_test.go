package services_test

import (
	"testing"

	"nantty/modules/users/src/modules/addresses/services"
)

func TestNormalizePhoneToE164(t *testing.T) {
	cases := []struct {
		raw   string
		want  string
		valid bool
	}{
		{"+234 803 441 7720", "+2348034417720", true},
		{"+1 (415) 555-0132", "+14155550132", true},
		{"08034417720", "08034417720", false},
		{"+0123456789", "+0123456789", false},
		{"+234", "+234", false},
		{"+2348034417720123", "+2348034417720123", false},
		{"+23480344abc20", "+23480344abc20", false},
	}
	for _, testCase := range cases {
		got, valid := services.NormalizePhoneToE164(testCase.raw)
		if got != testCase.want || valid != testCase.valid {
			t.Errorf("%q -> %q %v, want %q %v", testCase.raw, got, valid, testCase.want, testCase.valid)
		}
	}
}

func TestValidatePostalCodeForCountry(t *testing.T) {
	cases := []struct {
		country  string
		postal   string
		required bool
		valid    bool
	}{
		{"NG", "", false, true},
		{"NG", "100001", false, true},
		{"NG", "10001", false, false},
		{"GB", "", true, false},
		{"GB", "SW1A 1AA", true, true},
		{"GB", "SW1A", true, false},
		{"US", "94105-1234", true, true},
		{"US", "9410", true, false},
		{"NL", "1011 AB", true, true},
		{"XX", "AB-12", false, true},
		{"XX", "!!", false, false},
	}
	for _, testCase := range cases {
		if got := services.ValidatePostalCodeForCountry(testCase.country, testCase.postal, testCase.required); got != testCase.valid {
			t.Errorf("%+v got %v", testCase, got)
		}
	}
}
