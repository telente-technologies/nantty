package services

import (
	"testing"

	"github.com/google/uuid"

	retentionmodels "nantty/modules/users/src/modules/retention/models"
)

func TestDecideOutcomeNeverInventsDeletionAndDefersConfiguredPeriods(t *testing.T) {
	days, zero := 90, 0
	cases := []struct {
		name   string
		policy retentionmodels.PolicySnapshot
		want   string
	}{
		{"default retain", retentionmodels.PolicySnapshot{Category: "account", Action: "retain"}, OutcomeRetained},
		{"delete now", retentionmodels.PolicySnapshot{Category: "account", Action: "delete"}, OutcomeDeleted},
		{"delete with zero days", retentionmodels.PolicySnapshot{Category: "account", Action: "delete", RetentionDays: &zero}, OutcomeDeleted},
		{"anonymize now", retentionmodels.PolicySnapshot{Category: "consents", Action: "anonymize"}, OutcomeAnonymized},
		{"delete after period is deferred", retentionmodels.PolicySnapshot{Category: "consents", Action: "delete", RetentionDays: &days}, OutcomeDeferred},
		{"other services own orders", retentionmodels.PolicySnapshot{Category: "orders", Action: "delete"}, OutcomeDelegated},
		{"other services own security logs", retentionmodels.PolicySnapshot{Category: "security_logs", Action: "anonymize"}, OutcomeDelegated},
	}
	for _, testCase := range cases {
		if got := DecideOutcome(testCase.policy); got != testCase.want {
			t.Errorf("%s: got %s want %s", testCase.name, got, testCase.want)
		}
	}
}

func TestAnonymizedHandleIsStableAndValidLength(t *testing.T) {
	identifier := uuid.MustParse("0198a7c2-1111-7222-8333-444455556666")
	handle := AnonymizedHandleFor(identifier)
	if handle != AnonymizedHandleFor(identifier) || len(handle) != 16 || handle[:8] != "deleted_" {
		t.Fatalf("unexpected handle %q", handle)
	}
}
