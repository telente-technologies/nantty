package payments_test

import (
	"errors"
	"testing"

	payments "nantty/modules/payments/src"
	platformevents "nantty/platform/events"
)

func TestCreatorApplicationApprovedRejectsMissingAccountId(t *testing.T) {
	for _, accountId := range []string{"", "  \t"} {
		err := payments.ValidateCreatorApplicationApprovedEvent(accountId)
		if !errors.Is(err, platformevents.ErrPoisonMessage) {
			t.Fatalf("blank account id %q should be poison, got %v", accountId, err)
		}
	}
	if err := payments.ValidateCreatorApplicationApprovedEvent("creator-1"); err != nil {
		t.Fatalf("valid account id: %v", err)
	}
}

func TestBusinessVerificationEventValidatorsMatchRequiredContractFields(t *testing.T) {
	goldEligible := true
	goldGranted := false
	if err := payments.ValidateBusinessVerificationApprovedEvent("f47ac10b-58cc-4372-a567-0e02b2c3d479", &goldEligible, &goldGranted); err != nil {
		t.Fatalf("valid approval payload: %v", err)
	}
	if err := payments.ValidateBusinessVerificationApprovedEvent("not-a-uuid", &goldEligible, &goldGranted); !errors.Is(err, platformevents.ErrPoisonMessage) {
		t.Fatalf("invalid approval account id should be poison, got %v", err)
	}
	if err := payments.ValidateBusinessVerificationApprovedEvent("f47ac10b-58cc-4372-a567-0e02b2c3d479", nil, &goldGranted); !errors.Is(err, platformevents.ErrPoisonMessage) {
		t.Fatalf("missing approval contract field should be poison, got %v", err)
	}
	if err := payments.ValidateBusinessVerificationRevokedEvent("f47ac10b-58cc-4372-a567-0e02b2c3d479", "businessLicense", "document expired"); err != nil {
		t.Fatalf("valid revocation payload: %v", err)
	}
	if err := payments.ValidateBusinessVerificationRevokedEvent("f47ac10b-58cc-4372-a567-0e02b2c3d479", "", "document expired"); !errors.Is(err, platformevents.ErrPoisonMessage) {
		t.Fatalf("missing revocation contract field should be poison, got %v", err)
	}
}

func TestVerificationLevelRefreshRejectsBlankAccountId(t *testing.T) {
	for _, accountId := range []string{"", " \n"} {
		if err := payments.ValidateVerificationLevelRefreshEvent(accountId); !errors.Is(err, platformevents.ErrPoisonMessage) {
			t.Fatalf("blank account id %q should be poison, got %v", accountId, err)
		}
	}
	if err := payments.ValidateVerificationLevelRefreshEvent("account-1"); err != nil {
		t.Fatalf("valid account id: %v", err)
	}
}
