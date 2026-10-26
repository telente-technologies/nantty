package loginstaff

import (
	"context"
	"errors"
	"time"

	"nantty/modules/admin/src/container"
	adminerrors "nantty/modules/admin/src/errors"
	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffaccount"
	"nantty/modules/admin/src/generated/ent/staffloginchallenge"
	"nantty/modules/admin/src/generated/ent/staffwebauthncredential"
	"nantty/modules/admin/src/modules/staffAuth/models"
	"nantty/modules/admin/src/modules/staffAuth/services"
	"nantty/modules/admin/src/types"
	secrettokens "nantty/modules/admin/src/utils/secretTokens"
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
	if !(services.StaffAuthService{Container: handler.Container}).StaffAddressAllowed(staff, types.ClientDetailsFromContext(ctx).IpAddress) {
		return models.LoginChallengeResult{}, adminerrors.IpNotAllowed
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
	passkeys, countErr := handler.Container.Client.StaffWebauthnCredential.Query().Where(staffwebauthncredential.StaffID(staff.ID)).Count(ctx)
	return models.LoginChallengeResult{
		Status: status, ChallengeToken: token, ExpiresIn: int(handler.Container.Settings.LoginChallengeTtl / time.Second),
		PasskeyAvailable: purpose == staffloginchallenge.PurposeLogin && passkeys > 0 && handler.Container.WebAuthn != nil,
	}, errors.Join(err, countErr)
}
