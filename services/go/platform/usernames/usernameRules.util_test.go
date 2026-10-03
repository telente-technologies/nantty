package usernames

import "testing"

func TestNormalizeAndFormat(t *testing.T) {
	cases := []struct {
		raw       string
		wantName  string
		wantValid bool
	}{
		{"  @Ada.Lovelace ", "ada.lovelace", true},
		{"ab", "ab", false},
		{"_____", "_____", false},
		{".leading", ".leading", false},
		{"double..dot", "double..dot", false},
		{"123456", "123456", false},
		{"has space", "has space", false},
		{"ｆｕｌｌｗｉｄｔｈ", "fullwidth", true},
	}
	for _, testCase := range cases {
		got := NormalizeRequestedUsername(testCase.raw)
		if got != testCase.wantName || HasValidFormat(got) != testCase.wantValid {
			t.Errorf("%q: got %q valid=%v, want %q valid=%v", testCase.raw, got, HasValidFormat(got), testCase.wantName, testCase.wantValid)
		}
	}
}

func TestReservedAndConfusableNamesAreBlocked(t *testing.T) {
	rules := SystemReservedRules()
	blocked := []string{"admin", "admin_ng", "zudomart", "my.zudomart.shop", "paypa1", "g00gle", "googlehq", "official.google", "supp0rt", "rnicrosoft", "Zud0mart"}
	for _, name := range blocked {
		if _, found := FindMatchingReservedRule(NormalizeRequestedUsername(name), rules); !found {
			t.Errorf("%q should be blocked", name)
		}
	}
	allowed := []string{"ada.lovelace", "chidi_okafor", "tolu123", "googleplexity"}
	for _, name := range allowed {
		if rule, found := FindMatchingReservedRule(name, rules); found {
			t.Errorf("%q should be allowed but matched %+v", name, rule)
		}
	}
}

func TestGeneratedCandidatesAreValidAndAvoidReservedBases(t *testing.T) {
	rules := SystemReservedRules()
	for _, seed := range []string{"admin@example.com", "ab@x.io", "Ada.Lovelace@example.com"} {
		for _, candidate := range GenerateCandidates([]string{seed}, rules) {
			if !HasValidFormat(candidate) {
				t.Errorf("seed %q produced invalid %q", seed, candidate)
			}
		}
	}
	if first := GenerateCandidates([]string{"admin@example.com"}, rules)[0]; first[:4] != "user" {
		t.Errorf("reserved seed must fall back to user base, got %q", first)
	}
}

func TestAllIsReservedForGroupMentions(t *testing.T) {
	for _, candidate := range []string{"all", "All", "@ALL"} {
		if _, reserved := FindMatchingReservedRule(NormalizeRequestedUsername(candidate), SystemReservedRules()); !reserved {
			t.Errorf("%q must be reserved because @all notifies a whole group", candidate)
		}
	}
	if _, reserved := FindMatchingReservedRule("allison", SystemReservedRules()); reserved {
		t.Error("names that merely start with all stay available")
	}
}
