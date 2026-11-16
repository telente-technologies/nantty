package usernames_test

import (
	"testing"

	"nantty/platform/usernames"
)

func TestBuildSuggestionCandidatesAreValidUniqueAndUnreserved(t *testing.T) {
	rules := usernames.SystemReservedRules()
	pool := usernames.BuildSuggestionCandidates([]string{"sunny.day", "Sunny Day Person", "x@mail.com"}, rules, 2026)
	if len(pool) != 14 {
		t.Fatalf("pool size %d", len(pool))
	}
	seen := map[string]bool{}
	for _, candidate := range pool {
		if seen[candidate] || !usernames.HasValidFormat(candidate) {
			t.Fatalf("bad candidate %q", candidate)
		}
		if _, reserved := usernames.FindMatchingReservedRule(candidate, rules); reserved {
			t.Fatalf("reserved candidate %q", candidate)
		}
		seen[candidate] = true
	}
}

func TestBuildSuggestionCandidatesFallBackWhenSeedsAreUnusable(t *testing.T) {
	for _, candidate := range usernames.BuildSuggestionCandidates([]string{"", "!!", "nantty"}, usernames.SystemReservedRules(), 2026) {
		if len(candidate) < usernames.MinimumLength || len(candidate) > usernames.MaximumLength {
			t.Fatalf("bad fallback %q", candidate)
		}
	}
}
