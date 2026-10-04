package services

import (
	"context"

	"zudomart/modules/users/src/container"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/verificationeligibility"
	usersservices "zudomart/modules/users/src/services"
)

// RecheckQueuedEligibilityOnce asks Python again for every queued "Request verification" that is due. When an
// account now qualifies, StoreEligibilityAssessment sends the "You can now apply" notice exactly once.
func RecheckQueuedEligibilityOnce(ctx context.Context, application *container.Container, limit int) (checked int, becameEligible int) {
	rows, err := application.Client.VerificationEligibility.Query().
		Where(verificationeligibility.StateEQ(verificationeligibility.StateRequested), verificationeligibility.NextCheckAtLTE(application.Now())).
		Order(ent.Asc(verificationeligibility.FieldNextCheckAt)).Limit(limit).All(ctx)
	if err != nil {
		application.Logger.WarnContext(ctx, "verification eligibility recheck query failed", "error", err.Error())
		return 0, 0
	}
	for _, row := range rows {
		profile, err := application.Client.Profile.Get(ctx, row.ProfileID)
		if err != nil {
			continue
		}
		account, err := usersservices.LoadActiveAccountSummary(ctx, row.AccountID)
		if err != nil {
			continue
		}
		color, err := ColorForVerification(profile)
		if err != nil {
			continue
		}
		signals, err := BuildEligibilitySignals(ctx, application, profile, account, color)
		if err != nil {
			continue
		}
		change, err := StoreEligibilityAssessment(ctx, application, profile, color, AssessVerificationEligibility(ctx, application, signals), false)
		if err != nil {
			continue
		}
		checked++
		if change.BecameEligible {
			becameEligible++
		}
	}
	return checked, becameEligible
}
