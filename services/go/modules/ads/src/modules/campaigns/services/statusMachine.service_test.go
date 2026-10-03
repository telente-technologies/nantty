package services

import "testing"

func TestDerivedStatusFollowsTheAdsBeneathIt(t *testing.T) {
	cases := []struct {
		name     string
		children []string
		current  string
		want     string
	}{
		{"one approved ad activates the parent", []string{"active", "rejected"}, "in_review", "active"},
		{"all pending stays in review", []string{"in_review", "in_review"}, "draft", "in_review"},
		{"all rejected rejects the parent", []string{"rejected", "rejected"}, "in_review", "rejected"},
		{"pending beats rejected", []string{"rejected", "in_review"}, "rejected", "in_review"},
		{"paused parents are left alone", []string{"active"}, "paused", "paused"},
		{"completed parents are left alone", []string{"rejected"}, "completed", "completed"},
		{"drafts stay drafts", []string{"draft"}, "draft", "draft"},
	}
	for _, testCase := range cases {
		if got := derivedStatus(testCase.children, testCase.current); got != testCase.want {
			t.Errorf("%s: got %s want %s", testCase.name, got, testCase.want)
		}
	}
}

func TestStatusChangesAllowOnlyPauseAndResumeOfLiveItems(t *testing.T) {
	if RequireStatusChangeAllowed("active", "paused") != nil || RequireStatusChangeAllowed("paused", "active") != nil {
		t.Fatal("active and paused swap freely")
	}
	for _, current := range []string{"draft", "in_review", "rejected", "completed"} {
		if RequireStatusChangeAllowed(current, "active") == nil {
			t.Errorf("%s -> active must be refused", current)
		}
	}
	if RequireStatusChangeAllowed("active", "completed") == nil {
		t.Fatal("clients cannot complete items")
	}
}
