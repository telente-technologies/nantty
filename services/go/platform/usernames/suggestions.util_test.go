package usernames

import "testing"

func TestBuildSuggestionCandidatesAreValidUniqueAndUnreserved(t *testing.T) {
	rules := SystemReservedRules()
	pool := BuildSuggestionCandidates([]string{"sunny.day", "Sunny Day Person", "x@mail.com"}, rules, 2026)
	if len(pool) != suggestionPoolSize {
		t.Fatalf("pool size %d", len(pool))
	}
	seen := map[string]bool{}
	for _, candidate := range pool {
		if seen[candidate] || !HasValidFormat(candidate) {
			t.Fatalf("bad candidate %q", candidate)
		}
		if _, reserved := FindMatchingReservedRule(candidate, rules); reserved {
			t.Fatalf("reserved candidate %q", candidate)
		}
		seen[candidate] = true
	}
}

func TestBuildSuggestionCandidatesFallBackWhenSeedsAreUnusable(t *testing.T) {
	for _, candidate := range BuildSuggestionCandidates([]string{"", "!!", "zudomart"}, SystemReservedRules(), 2026) {
		if len(candidate) < MinimumLength || len(candidate) > MaximumLength {
			t.Fatalf("bad fallback %q", candidate)
		}
	}
}
