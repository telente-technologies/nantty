package verifyonetimecode

import (
	"context"
	"crypto/subtle"

	"nantty/modules/auth/src/container"
	authErrors "nantty/modules/auth/src/errors"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/onetimecode"
	"nantty/modules/auth/src/utils"
)

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) (Result, error) {
	destination, valid := utils.NormalizeEmailAddress(command.Destination)
	if !valid {
		return Result{}, authErrors.ErrInvalidOneTimeCode
	}
	purpose := onetimecode.Purpose(command.Purpose)
	verifiedToken, err := utils.GenerateOpaqueUrlSafeToken()
	if err != nil {
		return Result{}, err
	}
	var outcome error
	err = application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Now()
		active, err := tx.OneTimeCode.Query().
			Where(onetimecode.Destination(destination), onetimecode.PurposeEQ(purpose), onetimecode.ConsumedAtIsNil(), onetimecode.ExpiresAtGT(now)).
			Order(ent.Desc(onetimecode.FieldCreatedAt)).ForUpdate().First(ctx)
		if ent.IsNotFound(err) {
			outcome = authErrors.ErrInvalidOneTimeCode
			return nil
		}
		if err != nil {
			return err
		}
		if active.FailedAttempts >= application.Settings.OneTimeCodeMaximumAttempts {
			outcome = authErrors.ErrTooManyCodeAttempts
			return nil
		}
		expectedHash := utils.HashOneTimeCodeWithPepper(application.Settings.OneTimeCodePepper, destination, string(purpose), command.Code)
		if subtle.ConstantTimeCompare([]byte(expectedHash), []byte(active.SecretHash)) != 1 {
			outcome = authErrors.ErrInvalidOneTimeCode
			update := active.Update().AddFailedAttempts(1)
			if active.FailedAttempts+1 >= application.Settings.OneTimeCodeMaximumAttempts {
				update = update.SetConsumedAt(now)
				outcome = authErrors.ErrTooManyCodeAttempts
			}
			return update.Exec(ctx)
		}
		if err := active.Update().SetConsumedAt(now).Exec(ctx); err != nil {
			return err
		}
		return tx.OneTimeCode.Create().
			SetDestination(destination).SetPurpose(onetimecode.Purpose(string(purpose) + "_verified")).
			SetSecretHash(utils.HashOpaqueTokenForStorage(verifiedToken)).
			SetExpiresAt(now.Add(application.Settings.VerifiedDestinationTokenTtl)).Exec(ctx)
	})
	if err != nil {
		return Result{}, err
	}
	if outcome != nil {
		return Result{}, outcome
	}
	return Result{OtpToken: verifiedToken}, nil
}
