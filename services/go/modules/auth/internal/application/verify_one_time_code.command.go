package application

import (
	"context"
	"crypto/subtle"
	"time"

	"zudomart/modules/auth/internal/credentials"
	"zudomart/modules/auth/internal/ent"
	"zudomart/modules/auth/internal/ent/onetimecode"
)

type VerifyOneTimeCodeInput struct {
	Destination string
	Code        string
	Purpose     string
}

type VerifyOneTimeCodeResult struct {
	OtpToken string `json:"otpToken"`
}

func (application *AuthApplication) VerifyOneTimeCodeAndIssueVerifiedDestinationToken(ctx context.Context, input VerifyOneTimeCodeInput) (VerifyOneTimeCodeResult, error) {
	destination, valid := NormalizeEmailAddress(input.Destination)
	if !valid {
		return VerifyOneTimeCodeResult{}, errInvalidOneTimeCode
	}
	purpose := onetimecode.Purpose(input.Purpose)
	verifiedToken, err := credentials.GenerateOpaqueUrlSafeToken()
	if err != nil {
		return VerifyOneTimeCodeResult{}, err
	}
	var outcome error
	err = application.runInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Now()
		active, err := tx.OneTimeCode.Query().
			Where(onetimecode.Destination(destination), onetimecode.PurposeEQ(purpose), onetimecode.ConsumedAtIsNil(), onetimecode.ExpiresAtGT(now)).
			Order(ent.Desc(onetimecode.FieldCreatedAt)).ForUpdate().First(ctx)
		if ent.IsNotFound(err) {
			outcome = errInvalidOneTimeCode
			return nil
		}
		if err != nil {
			return err
		}
		if active.FailedAttempts >= application.Settings.OneTimeCodeMaximumAttempts {
			outcome = errTooManyCodeAttempts
			return nil
		}
		expectedHash := credentials.HashOneTimeCodeWithPepper(application.Settings.OneTimeCodePepper, destination, string(purpose), input.Code)
		if subtle.ConstantTimeCompare([]byte(expectedHash), []byte(active.SecretHash)) != 1 {
			outcome = errInvalidOneTimeCode
			update := active.Update().AddFailedAttempts(1)
			if active.FailedAttempts+1 >= application.Settings.OneTimeCodeMaximumAttempts {
				update = update.SetConsumedAt(now)
				outcome = errTooManyCodeAttempts
			}
			return update.Exec(ctx)
		}
		if err := active.Update().SetConsumedAt(now).Exec(ctx); err != nil {
			return err
		}
		return tx.OneTimeCode.Create().
			SetDestination(destination).SetPurpose(onetimecode.Purpose(string(purpose) + "_verified")).
			SetSecretHash(credentials.HashOpaqueTokenForStorage(verifiedToken)).
			SetExpiresAt(now.Add(application.Settings.VerifiedDestinationTokenTtl)).Exec(ctx)
	})
	if err != nil {
		return VerifyOneTimeCodeResult{}, err
	}
	if outcome != nil {
		return VerifyOneTimeCodeResult{}, outcome
	}
	return VerifyOneTimeCodeResult{OtpToken: verifiedToken}, nil
}

func consumeVerifiedDestinationTokenInTransaction(ctx context.Context, tx *ent.Tx, purpose onetimecode.Purpose, verifiedToken string, now func() time.Time) (string, error) {
	record, err := tx.OneTimeCode.Query().
		Where(onetimecode.SecretHash(credentials.HashOpaqueTokenForStorage(verifiedToken)), onetimecode.PurposeEQ(purpose), onetimecode.ConsumedAtIsNil(), onetimecode.ExpiresAtGT(now())).
		ForUpdate().Only(ctx)
	if ent.IsNotFound(err) {
		return "", errDestinationNotProven
	}
	if err != nil {
		return "", err
	}
	if err := record.Update().SetConsumedAt(now()).Exec(ctx); err != nil {
		return "", err
	}
	return record.Destination, nil
}
