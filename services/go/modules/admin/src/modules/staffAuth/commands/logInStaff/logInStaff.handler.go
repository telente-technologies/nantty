package loginstaff

import (
	"context"
	"time"

	"zudomart/modules/admin/src/container"
	adminerrors "zudomart/modules/admin/src/errors"
	"zudomart/modules/admin/src/generated/ent"
	"zudomart/modules/admin/src/generated/ent/staffaccount"
	"zudomart/modules/admin/src/generated/ent/staffloginchallenge"
	"zudomart/modules/admin/src/modules/staffAuth/models"
	"zudomart/modules/admin/src/modules/staffAuth/services"
	secrettokens "zudomart/modules/admin/src/utils/secretTokens"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (models.LoginChallengeResult, error) {
	passwords := handler.Container.Passwords
	email, valid := secrettokens.NormalizeStaffEmail(command.Email)
	if !valid {
		passwords.SpendEquivalentTimeWhenAccountIsMissing(command.Password)
		return models.LoginChallengeResult{}, adminerrors.InvalidCredentials
	}
	staff, err := handler.Container.Client.StaffAccount.Query().Where(staffaccount.Email(email)).Only(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return models.LoginChallengeResult{}, err
	}
	now := handler.Container.Now()
	if staff == nil || staff.Status != staffaccount.StatusActive || staff.PasswordHash == nil || (staff.LockedUntil != nil && staff.LockedUntil.After(now)) {
		passwords.SpendEquivalentTimeWhenAccountIsMissing(command.Password)
		return models.LoginChallengeResult{}, adminerrors.InvalidCredentials
	}
	matches, err := passwords.VerifyPasswordAgainstArgon2idHash(command.Password, *staff.PasswordHash)
	if err != nil || !matches {
		return models.LoginChallengeResult{}, services.StaffAuthService{Container: handler.Container}.RecordFailedPasswordAttemptAndMaybeLock(ctx, staff.ID, adminerrors.InvalidCredentials)
	}
	return handler.createChallengeAfterPasswordProof(ctx, staff)
}

func (handler Handler) createChallengeAfterPasswordProof(ctx context.Context, staff *ent.StaffAccount) (models.LoginChallengeResult, error) {
	purpose, status := staffloginchallenge.PurposeLogin, "mfa_required"
	if staff.TotpConfirmedAt == nil {
		purpose, status = staffloginchallenge.PurposeEnroll, "mfa_enrollment_required"
	}
	token, err := secrettokens.GenerateOpaqueUrlSafeToken()
	if err != nil {
		return models.LoginChallengeResult{}, err
	}
	err = handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.StaffAccount.UpdateOneID(staff.ID).SetFailedAttempts(0).ClearLockedUntil().Exec(ctx); err != nil {
			return err
		}
		return tx.StaffLoginChallenge.Create().SetStaffID(staff.ID).SetTokenHash(secrettokens.HashOpaqueTokenForStorage(token)).
			SetPurpose(purpose).SetExpiresAt(handler.Container.Now().Add(handler.Container.Settings.LoginChallengeTtl)).Exec(ctx)
	})
	return models.LoginChallengeResult{Status: status, ChallengeToken: token, ExpiresIn: int(handler.Container.Settings.LoginChallengeTtl / time.Second)}, err
}
