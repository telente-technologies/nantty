package application

import (
	"context"

	"zudomart/modules/auth/src/utils"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/account"
	"zudomart/modules/auth/src/generated/ent/onetimecode"
)

type SendOneTimeCodeInput struct {
	Destination string
	Purpose     string
}

type SendOneTimeCodeResult struct {
	ExpiresIn int `json:"expiresIn"`
}

func (application *AuthApplication) SendOneTimeCodeWithoutRevealingAccountExistence(ctx context.Context, input SendOneTimeCodeInput) (SendOneTimeCodeResult, error) {
	result := SendOneTimeCodeResult{ExpiresIn: int(application.Settings.OneTimeCodeTimeToLive.Seconds())}
	destination, valid := NormalizeEmailAddress(input.Destination)
	if !valid {
		return result, unprocessable("Enter a valid email address.")
	}
	purpose := onetimecode.Purpose(input.Purpose)
	accountExists, err := application.Client.Account.Query().Where(account.Email(destination)).Exist(ctx)
	if err != nil {
		return result, err
	}
	if purpose == onetimecode.PurposeSignup && accountExists {
		return result, application.Delivery.DeliverAccountAlreadyExistsNotice(ctx, destination)
	}
	if purpose != onetimecode.PurposeSignup && !accountExists {
		return result, nil
	}
	code, err := credentials.GenerateSixDigitOneTimeCode()
	if err != nil {
		return result, err
	}
	sendNewCode := false
	err = application.runInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Now()
		latest, err := tx.OneTimeCode.Query().
			Where(onetimecode.Destination(destination), onetimecode.PurposeEQ(purpose), onetimecode.ConsumedAtIsNil(), onetimecode.ExpiresAtGT(now)).
			Order(ent.Desc(onetimecode.FieldCreatedAt)).ForUpdate().First(ctx)
		if err != nil && !ent.IsNotFound(err) {
			return err
		}
		if latest != nil && now.Sub(latest.CreatedAt) < application.Settings.OneTimeCodeResendCooldown {
			return nil
		}
		if err := tx.OneTimeCode.Update().
			Where(onetimecode.Destination(destination), onetimecode.PurposeEQ(purpose), onetimecode.ConsumedAtIsNil()).
			SetConsumedAt(now).Exec(ctx); err != nil {
			return err
		}
		sendNewCode = true
		return tx.OneTimeCode.Create().
			SetDestination(destination).SetPurpose(purpose).
			SetSecretHash(credentials.HashOneTimeCodeWithPepper(application.Settings.OneTimeCodePepper, destination, string(purpose), code)).
			SetExpiresAt(now.Add(application.Settings.OneTimeCodeTimeToLive)).Exec(ctx)
	})
	if err != nil || !sendNewCode {
		return result, err
	}
	return result, application.Delivery.DeliverOneTimeCode(ctx, destination, string(purpose), code)
}
