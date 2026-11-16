package ipallowlist_test

import (
	"testing"

	"nantty/modules/admin/src/utils/ipAllowList"
)

func TestAllowListMatchesExactAddressesCidrRangesAndMappedIpv4(t *testing.T) {
	entries := []string{"203.0.113.7", "10.20.0.0/16", "2001:db8::/32"}
	cases := []struct {
		address string
		allowed bool
	}{
		{"203.0.113.7", true},
		{"203.0.113.8", false},
		{"10.20.255.1", true},
		{"10.21.0.1", false},
		{"::ffff:10.20.1.1", true},
		{"::ffff:203.0.113.7", true},
		{"2001:db8:1::5", true},
		{"2001:db9::1", false},
		{"", false},
		{"not-an-ip", false},
	}
	for _, testCase := range cases {
		if got := ipallowlist.IsAddressAllowed(testCase.address, entries); got != testCase.allowed {
			t.Errorf("%q: got %v, want %v", testCase.address, got, testCase.allowed)
		}
	}
	if !ipallowlist.IsAddressAllowed("198.51.100.1", nil) {
		t.Fatal("an empty list allows every address")
	}
}

func TestEntriesAreValidatedAndNormalized(t *testing.T) {
	normalized, valid := ipallowlist.NormalizeEntries([]string{" 10.0.0.9/8 ", "::ffff:192.0.2.1", "10.0.0.0/8", "2001:db8::1"})
	if !valid {
		t.Fatal("expected valid entries")
	}
	want := []string{"10.0.0.0/8", "192.0.2.1/32", "2001:db8::1/128"}
	if len(normalized) != len(want) {
		t.Fatalf("got %v", normalized)
	}
	for index := range want {
		if normalized[index] != want[index] {
			t.Fatalf("got %v, want %v", normalized, want)
		}
	}
	for _, invalid := range []string{"10.0.0.0/33", "2001:db8::/129", "300.1.1.1", "fe80::1%eth0", "10.0.0.0/8/1", ""} {
		if _, ok := ipallowlist.NormalizeEntries([]string{invalid}); ok {
			t.Errorf("%q must be rejected", invalid)
		}
	}
}
