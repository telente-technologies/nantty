package src

import (
	"errors"
	"testing"

	platformevents "nantty/platform/events"
)

func TestCreatorApplicationApprovedRejectsMissingAccountId(t *testing.T) {
	for _, accountId := range []string{"", "  \t"} {
		err := validateCreatorApplicationApprovedEvent(accountId)
		if !errors.Is(err, platformevents.ErrPoisonMessage) {
			t.Fatalf("blank account id %q should be poison, got %v", accountId, err)
		}
	}
	if err := validateCreatorApplicationApprovedEvent("creator-1"); err != nil {
		t.Fatalf("valid account id: %v", err)
	}
}

func TestBusinessVerificationEventValidatorsMatchRequiredContractFields(t *testing.T) {
	goldEligible := true
	goldGranted := false
	if err := validateBusinessVerificationApprovedEvent("f47ac10b-58cc-4372-a567-0e02b2c3d479", &goldEligible, &goldGranted); err != nil {
		t.Fatalf("valid approval payload: %v", err)
	}
	if err := validateBusinessVerificationApprovedEvent("not-a-uuid", &goldEligible, &goldGranted); !errors.Is(err, platformevents.ErrPoisonMessage) {
		t.Fatalf("invalid approval account id should be poison, got %v", err)
	}
	if err := validateBusinessVerificationApprovedEvent("f47ac10b-58cc-4372-a567-0e02b2c3d479", nil, &goldGranted); !errors.Is(err, platformevents.ErrPoisonMessage) {
		t.Fatalf("missing approval contract field should be poison, got %v", err)
	}
	if err := validateBusinessVerificationRevokedEvent("f47ac10b-58cc-4372-a567-0e02b2c3d479", "businessLicense", "document expired"); err != nil {
		t.Fatalf("valid revocation payload: %v", err)
	}
	if err := validateBusinessVerificationRevokedEvent("f47ac10b-58cc-4372-a567-0e02b2c3d479", "", "document expired"); !errors.Is(err, platformevents.ErrPoisonMessage) {
		t.Fatalf("missing revocation contract field should be poison, got %v", err)
	}
}

func TestVerificationLevelRefreshRejectsBlankAccountId(t *testing.T) {
	for _, accountId := range []string{"", " \n"} {
		if err := validateVerificationLevelRefreshEvent(accountId); !errors.Is(err, platformevents.ErrPoisonMessage) {
			t.Fatalf("blank account id %q should be poison, got %v", accountId, err)
		}
	}
	if err := validateVerificationLevelRefreshEvent("account-1"); err != nil {
		t.Fatalf("valid account id: %v", err)
	}
}
