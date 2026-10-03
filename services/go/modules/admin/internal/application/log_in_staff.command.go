package application

import (
	"context"
	"time"

	"zudomart/modules/admin/internal/ent"
	"zudomart/modules/admin/internal/ent/staffaccount"
	"zudomart/modules/admin/internal/ent/staffloginchallenge"
)

type LoginChallengeResult struct {
	Status         string `json:"status"`
	ChallengeToken string `json:"challengeToken"`
	ExpiresIn      int    `json:"expiresIn"`
}

func (application *AdminApplication) LogInStaffWithPassword(ctx context.Context, rawEmail, password string) (LoginChallengeResult, error) {
	email, valid := NormalizeStaffEmail(rawEmail)
	if !valid {
		application.Passwords.SpendEquivalentTimeWhenAccountIsMissing(password)
		return LoginChallengeResult{}, errInvalidCredentials
	}
	staff, err := application.Client.StaffAccount.Query().Where(staffaccount.Email(email)).Only(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return LoginChallengeResult{}, err
	}
	now := application.Now()
	if staff == nil || staff.Status != staffaccount.StatusActive || staff.PasswordHash == nil || (staff.LockedUntil != nil && staff.LockedUntil.After(now)) {
		application.Passwords.SpendEquivalentTimeWhenAccountIsMissing(password)
		return LoginChallengeResult{}, errInvalidCredentials
	}
	matches, err := application.Passwords.VerifyPasswordAgainstArgon2idHash(password, *staff.PasswordHash)
	if err != nil || !matches {
		return LoginChallengeResult{}, application.recordFailedAttemptAndMaybeLock(ctx, staff.ID, errInvalidCredentials)
	}
	return application.createChallengeAfterPasswordProof(ctx, staff)
}

func (application *AdminApplication) createChallengeAfterPasswordProof(ctx context.Context, staff *ent.StaffAccount) (LoginChallengeResult, error) {
	purpose := staffloginchallenge.PurposeLogin
	status := "mfa_required"
	if staff.TotpConfirmedAt == nil {
		purpose, status = staffloginchallenge.PurposeEnroll, "mfa_enrollment_required"
	}
	token, err := generateOpaqueUrlSafeToken()
	if err != nil {
		return LoginChallengeResult{}, err
	}
	err = application.runInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.StaffAccount.UpdateOneID(staff.ID).SetFailedAttempts(0).ClearLockedUntil().Exec(ctx); err != nil {
			return err
		}
		return tx.StaffLoginChallenge.Create().SetStaffID(staff.ID).SetTokenHash(hashOpaqueTokenForStorage(token)).
			SetPurpose(purpose).SetExpiresAt(application.Now().Add(application.Settings.LoginChallengeTtl)).Exec(ctx)
	})
	return LoginChallengeResult{Status: status, ChallengeToken: token, ExpiresIn: int((application.Settings.LoginChallengeTtl / time.Second))}, err
}
