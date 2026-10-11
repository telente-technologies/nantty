package services

import "testing"

func TestAccountAffectingChatActionsRequireStepUp(t *testing.T) {
	for _, action := range []string{"WARN_USER", "RESTRICT_USER", "SUSPEND_USER", "BAN_USER", "REMOVE_GROUP", "ESCALATE_LEGAL"} {
		if rule, known := ActionRules[action]; !known || !rule.NeedsStepUp {
			t.Fatalf("%s must require step-up", action)
		}
	}
}
