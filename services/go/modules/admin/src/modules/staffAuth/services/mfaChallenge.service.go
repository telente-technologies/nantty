package services

import (
	"context"

	"github.com/google/uuid"

	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	"zudomart/modules/admin/src/generated/ent/staffloginchallenge"
	"zudomart/modules/admin/src/modules/staffAuth/models"
	"zudomart/modules/admin/src/repositories"
	secrettokens "zudomart/modules/admin/src/utils/secretTokens"
	"zudomart/platform/identityports"
)

func (service StaffAuthService) CompleteMfaChallenge(ctx context.Context, challengeToken, code string, purpose staffloginchallenge.Purpose) (models.StaffSessionResult, error) {
	var rejection error
	var staff *ent.StaffAccount
	var sessionId uuid.UUID
	var refreshToken string
	err := service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := service.Container.Now()
		challenge, err := tx.StaffLoginChallenge.Query().
			Where(staffloginchallenge.TokenHash(secrettokens.HashOpaqueTokenForStorage(challengeToken)), staffloginchallenge.PurposeEQ(purpose),
				staffloginchallenge.ConsumedAtIsNil(), staffloginchallenge.ExpiresAtGT(now)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			rejection = adminerrors.InvalidChallenge
			return nil
		}
		if err != nil {
			return err
		}
		if staff, err = tx.StaffAccount.Query().Where(staffaccount.ID(challenge.StaffID)).ForUpdate().Only(ctx); err != nil {
			return err
		}
		if staff.Status != staffaccount.StatusActive {
			rejection = adminerrors.InvalidChallenge
			return nil
		}
		step, matched, err := service.CheckTotpCodeAgainstStaff(staff, code, now)
		if err != nil {
			rejection = err
			return nil
		}
		if !matched || challenge.Attempts >= service.Container.Settings.MaximumFailedPasswords {
			rejection = adminerrors.InvalidMfaCode
			return service.registerFailedChallengeAttemptInTransaction(ctx, tx, challenge, &rejection)
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
		if sessionId, refreshToken, err = service.StartSessionInTransaction(ctx, tx, staff); err != nil {
			return err
		}
		action := "staff.logged_in"
		if purpose == staffloginchallenge.PurposeEnroll {
			action = "staff.mfa_enrolled"
		}
		return repositories.RecordAuditEventInTransaction(ctx, tx, identityports.AuditEvent{
			ActorId: staff.ID.String(), ActorRole: string(staff.Role), Action: action, SubjectType: "staff", SubjectId: staff.ID.String(),
		})
	})
	if err != nil {
		return models.StaffSessionResult{}, err
	}
	if rejection != nil {
		return models.StaffSessionResult{}, rejection
	}
	return service.BuildSessionResult(staff, sessionId, refreshToken)
}

func (service StaffAuthService) registerFailedChallengeAttemptInTransaction(ctx context.Context, tx *ent.Tx, challenge *ent.StaffLoginChallenge, rejection *error) error {
	update := challenge.Update().AddAttempts(1)
	if challenge.Attempts+1 >= service.Container.Settings.MaximumFailedPasswords {
		update.SetConsumedAt(service.Container.Now())
		*rejection = adminerrors.TooManyMfaAttempts
	}
	return update.Exec(ctx)
}
