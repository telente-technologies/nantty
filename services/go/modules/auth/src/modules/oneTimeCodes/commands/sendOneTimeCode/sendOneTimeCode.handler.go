package sendonetimecode

import (
	"context"

	"zudomart/modules/auth/src/container"
	authErrors "zudomart/modules/auth/src/errors"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/account"
	"zudomart/modules/auth/src/generated/ent/onetimecode"
	"zudomart/modules/auth/src/services"
	"zudomart/modules/auth/src/utils"
)

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) (Result, error) {
	result := Result{ExpiresIn: int(application.Settings.OneTimeCodeTimeToLive.Seconds())}
	destination, valid := utils.NormalizeEmailAddress(command.Destination)
	if !valid {
		return result, authErrors.Unprocessable("Enter a valid email address.")
	}
	purpose := onetimecode.Purpose(command.Purpose)
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
	code, err := utils.GenerateSixDigitOneTimeCode()
	if err != nil {
		return result, err
	}
	sendNewCode := false
	err = application.RunInTransaction(ctx, func(tx *ent.Tx) error {
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
		allowed, err := services.WithinOneTimeCodeSendBudget(ctx, tx.Client(), destination, now, application.Settings.OneTimeCodeMaximumSendsPerHour)
		if err != nil || !allowed {
			return err
		}
		if err := tx.OneTimeCode.Update().
			Where(onetimecode.Destination(destination), onetimecode.PurposeEQ(purpose), onetimecode.ConsumedAtIsNil()).
			SetConsumedAt(now).Exec(ctx); err != nil {
			return err
		}
		sendNewCode = true
		return tx.OneTimeCode.Create().
			SetDestination(destination).SetPurpose(purpose).
			SetSecretHash(utils.HashOneTimeCodeWithPepper(application.Settings.OneTimeCodePepper, destination, string(purpose), code)).
			SetExpiresAt(now.Add(application.Settings.OneTimeCodeTimeToLive)).Exec(ctx)
	})
	if err != nil || !sendNewCode {
		return result, err
	}
	return result, application.Delivery.DeliverOneTimeCode(ctx, destination, string(purpose), code)
}
