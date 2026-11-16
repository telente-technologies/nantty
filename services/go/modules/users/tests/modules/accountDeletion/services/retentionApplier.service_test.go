package services_test

import (
	"testing"

	"github.com/google/uuid"

	"nantty/modules/users/src/modules/accountDeletion/services"
	retentionmodels "nantty/modules/users/src/modules/retention/models"
)

func TestDecideOutcomeNeverInventsDeletionAndDefersConfiguredPeriods(t *testing.T) {
	days, zero := 90, 0
	cases := []struct {
		name   string
		policy retentionmodels.PolicySnapshot
		want   string
	}{
		{"default retain", retentionmodels.PolicySnapshot{Category: "account", Action: "retain"}, services.OutcomeRetained},
		{"delete now", retentionmodels.PolicySnapshot{Category: "account", Action: "delete"}, services.OutcomeDeleted},
		{"delete with zero days", retentionmodels.PolicySnapshot{Category: "account", Action: "delete", RetentionDays: &zero}, services.OutcomeDeleted},
		{"anonymize now", retentionmodels.PolicySnapshot{Category: "consents", Action: "anonymize"}, services.OutcomeAnonymized},
		{"delete after period is deferred", retentionmodels.PolicySnapshot{Category: "consents", Action: "delete", RetentionDays: &days}, services.OutcomeDeferred},
		{"other services own orders", retentionmodels.PolicySnapshot{Category: "orders", Action: "delete"}, services.OutcomeDelegated},
		{"other services own security logs", retentionmodels.PolicySnapshot{Category: "security_logs", Action: "anonymize"}, services.OutcomeDelegated},
	}
	for _, testCase := range cases {
		if got := services.DecideOutcome(testCase.policy); got != testCase.want {
			t.Errorf("%s: got %s want %s", testCase.name, got, testCase.want)
		}
	}
}

func TestAnonymizedHandleIsStableAndValidLength(t *testing.T) {
	identifier := uuid.MustParse("0198a7c2-1111-7222-8333-444455556666")
	handle := services.AnonymizedHandleFor(identifier)
	if handle != services.AnonymizedHandleFor(identifier) || len(handle) != 16 || handle[:8] != "deleted_" {
		t.Fatalf("unexpected handle %q", handle)
	}
}
