package services_test

import (
	"testing"

	"nantty/modules/moderation/src/modules/chatReports/services"
)

func TestAccountAffectingChatActionsRequireStepUp(t *testing.T) {
	for _, action := range []string{"WARN_USER", "RESTRICT_USER", "SUSPEND_USER", "BAN_USER", "REMOVE_GROUP", "ESCALATE_LEGAL"} {
		if rule, known := services.ActionRules[action]; !known || !rule.NeedsStepUp {
			t.Fatalf("%s must require step-up", action)
		}
	}
}
