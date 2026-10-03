package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/admin/internal/ent"
	"zudomart/modules/admin/internal/ent/staffaccount"
	"zudomart/modules/admin/internal/ent/staffloginchallenge"
	"zudomart/platform/identityports"
)

func (application *AdminApplication) CompleteLoginWithTotpCode(ctx context.Context, challengeToken, code string) (StaffSessionResult, error) {
	return application.completeMfaChallenge(ctx, challengeToken, code, staffloginchallenge.PurposeLogin)
}

func (application *AdminApplication) ConfirmTotpEnrollmentAndStartSession(ctx context.Context, challengeToken, code string) (StaffSessionResult, error) {
	return application.completeMfaChallenge(ctx, challengeToken, code, staffloginchallenge.PurposeEnroll)
}

func (application *AdminApplication) completeMfaChallenge(ctx context.Context, challengeToken, code string, purpose staffloginchallenge.Purpose) (StaffSessionResult, error) {
	var rejection error
	var staff *ent.StaffAccount
	var sessionId uuid.UUID
	var refreshToken string
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Now()
		challenge, err := tx.StaffLoginChallenge.Query().
			Where(staffloginchallenge.TokenHash(hashOpaqueTokenForStorage(challengeToken)), staffloginchallenge.PurposeEQ(purpose),
				staffloginchallenge.ConsumedAtIsNil(), staffloginchallenge.ExpiresAtGT(now)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			rejection = errInvalidChallenge
			return nil
		}
		if err != nil {
			return err
		}
		if staff, err = tx.StaffAccount.Query().Where(staffaccount.ID(challenge.StaffID)).ForUpdate().Only(ctx); err != nil {
			return err
		}
		if staff.Status != staffaccount.StatusActive {
			rejection = errInvalidChallenge
			return nil
		}
		step, matched, err := application.checkTotpCodeAgainstStaff(staff, code, now)
		if err != nil {
			rejection = err
			return nil
		}
		if !matched || challenge.Attempts >= application.Settings.MaximumFailedPasswords {
			rejection = errInvalidMfaCode
			return application.registerFailedChallengeAttemptInTransaction(ctx, tx, challenge, &rejection)
		}
		if err := challenge.Update().SetConsumedAt(now).Exec(ctx); err != nil {
			return err
		}
		update := tx.StaffAccount.UpdateOneID(staff.ID).SetTotpLastUsedStep(step)
		if purpose == staffloginchallenge.PurposeEnroll {
			update.SetTotpConfirmedAt(now)
		}
		if staff, err = update.Save(ctx); err != nil {
			return err
		}
		if sessionId, refreshToken, err = application.startSessionInTransaction(ctx, tx, staff); err != nil {
			return err
		}
		action := "staff.logged_in"
		if purpose == staffloginchallenge.PurposeEnroll {
			action = "staff.mfa_enrolled"
		}
		return application.recordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: staff.ID.String(), ActorRole: string(staff.Role), Action: action, SubjectType: "staff", SubjectId: staff.ID.String(),
		})
	})
	if err != nil {
		return StaffSessionResult{}, err
	}
	if rejection != nil {
		return StaffSessionResult{}, rejection
	}
	return application.buildSessionResult(staff, sessionId, refreshToken)
}

func (application *AdminApplication) registerFailedChallengeAttemptInTransaction(ctx context.Context, tx *ent.Tx, challenge *ent.StaffLoginChallenge, rejection *error) error {
	update := challenge.Update().AddAttempts(1)
	if challenge.Attempts+1 >= application.Settings.MaximumFailedPasswords {
		update.SetConsumedAt(application.Now())
		*rejection = errTooManyMfaAttempts
	}
	return update.Exec(ctx)
}
