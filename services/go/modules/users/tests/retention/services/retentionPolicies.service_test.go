package services_test

import (
	"testing"

	"nantty/modules/users/src/generated/ent"
	"nantty/modules/users/src/generated/ent/retentionpolicy"
	"nantty/modules/users/src/modules/retention/services"
)

func TestActionForDefaultsToRetainWhenNothingIsConfigured(t *testing.T) {
	days := 30
	rows := []*ent.RetentionPolicy{
		{Category: retentionpolicy.CategoryConsents, Action: retentionpolicy.ActionAnonymize, RetentionDays: &days},
		{Category: retentionpolicy.CategoryAccount, Action: retentionpolicy.ActionDelete},
	}
	if action, kept := services.ActionFor(rows, "consents"); action != "anonymize" || kept == nil || *kept != 30 {
		t.Fatalf("got %s %v", action, kept)
	}
	if action, kept := services.ActionFor(rows, "account"); action != "delete" || kept != nil {
		t.Fatalf("got %s %v", action, kept)
	}
	if action, kept := services.ActionFor(rows, "orders"); action != "retain" || kept != nil {
		t.Fatalf("unconfigured categories must default to retain, got %s %v", action, kept)
	}
	if snapshot := services.SnapshotOf(rows); len(snapshot) != 2 || snapshot[0].Category != "consents" {
		t.Fatalf("snapshot %+v", snapshot)
	}
}
