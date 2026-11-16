package services_test

import (
	"testing"

	"nantty/modules/moderation/src/modules/copyrightClaims/services"
)

func TestDefaultsMeetNigerianRepeatInfringerRule(t *testing.T) {
	settings := services.DefaultPolicySettings()
	if settings.RestrictionThreshold != 2 || settings.RestrictionDays < 30 {
		t.Fatalf("a repeat infringement must bring at least a 30-day suspension, got threshold %d for %d days", settings.RestrictionThreshold, settings.RestrictionDays)
	}
	if field, ok := services.ValidatePolicySettings(settings); !ok {
		t.Fatalf("defaults must validate, %s failed", field)
	}
}

func TestStaffCannotLoosenBelowTheLegalFloor(t *testing.T) {
	tooLenient := services.DefaultPolicySettings()
	tooLenient.RestrictionThreshold = 3
	if field, ok := services.ValidatePolicySettings(tooLenient); ok || field != "restrictionThreshold" {
		t.Fatalf("a third-strike threshold must be rejected, got %q %v", field, ok)
	}
	tooShort := services.DefaultPolicySettings()
	tooShort.RestrictionDays = 7
	if field, ok := services.ValidatePolicySettings(tooShort); ok || field != "restrictionDays" {
		t.Fatalf("a suspension shorter than 30 days must be rejected, got %q %v", field, ok)
	}
}

func TestStoredLenientSettingsAreRaisedToTheLegalFloor(t *testing.T) {
	stored := services.PolicySettings{RestrictionThreshold: 3, RestrictionDays: 14}
	got := services.ApplyPolicyLegalFloor(stored)
	if got.RestrictionThreshold != 2 || got.RestrictionDays != 30 {
		t.Fatalf("old saved settings must be raised to the legal floor, got %+v", got)
	}
}
