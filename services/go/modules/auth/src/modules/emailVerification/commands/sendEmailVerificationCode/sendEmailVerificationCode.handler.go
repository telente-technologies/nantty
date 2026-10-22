package sendemailverificationcode

import (
	"context"
	"math"
	"net/http"
	"time"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/container"
	authErrors "zudomart/modules/auth/src/errors"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/onetimecode"
	"zudomart/modules/auth/src/modules/emailVerification/dtos"
	"zudomart/modules/auth/src/services"
	"zudomart/modules/auth/src/utils"
	"zudomart/platform/httpserver"
)

var (
	ErrEmailMissing    = httpserver.NewApiError(http.StatusUnprocessableEntity, "EMAIL_MISSING", "Add an email address to your account first.")
	ErrAlreadyVerified = httpserver.NewApiError(http.StatusConflict, "ALREADY_VERIFIED", "Your email address is already verified.")
)

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) (dtos.EmailVerificationSentResponse, error) {
	accountId, err := uuid.Parse(command.AccountId)
	if err != nil {
		return dtos.EmailVerificationSentResponse{}, authErrors.ErrInvalidCredentials
	}
	existing, err := application.Client.Account.Get(ctx, accountId)
	if ent.IsNotFound(err) {
		return dtos.EmailVerificationSentResponse{}, authErrors.ErrInvalidCredentials
	}
	if err != nil {
		return dtos.EmailVerificationSentResponse{}, err
	}
	if existing.Email == nil || *existing.Email == "" {
		return dtos.EmailVerificationSentResponse{}, ErrEmailMissing
	}
	if existing.EmailVerifiedAt != nil {
		return dtos.EmailVerificationSentResponse{}, ErrAlreadyVerified
	}
	destination := *existing.Email
	purpose := onetimecode.PurposeEmailVerification
	cooldown := application.Settings.OneTimeCodeResendCooldown
	response := dtos.EmailVerificationSentResponse{ExpiresIn: int(application.Settings.OneTimeCodeTimeToLive.Seconds()), ResendAfterSeconds: int(cooldown.Seconds())}
	code, err := utils.GenerateSixDigitOneTimeCode()
	if err != nil {
		return response, err
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
		if latest != nil && now.Sub(latest.CreatedAt) < cooldown {
			response.ResendAfterSeconds = int(math.Ceil((cooldown - now.Sub(latest.CreatedAt)).Seconds()))
			response.ExpiresIn = int(latest.ExpiresAt.Sub(now).Seconds())
			return nil
		}
		allowed, err := services.WithinOneTimeCodeSendBudget(ctx, tx.Client(), destination, now, application.Settings.OneTimeCodeMaximumSendsPerHour)
		if err != nil || !allowed {
			response.ResendAfterSeconds = int(time.Hour.Seconds())
			return err
		}
		if err := tx.OneTimeCode.Update().Where(onetimecode.Destination(destination), onetimecode.PurposeEQ(purpose), onetimecode.ConsumedAtIsNil()).SetConsumedAt(now).Exec(ctx); err != nil {
			return err
		}
		sendNewCode = true
		return tx.OneTimeCode.Create().SetDestination(destination).SetPurpose(purpose).
			SetSecretHash(utils.HashOneTimeCodeWithPepper(application.Settings.OneTimeCodePepper, destination, string(purpose), code)).
			SetExpiresAt(now.Add(application.Settings.OneTimeCodeTimeToLive)).Exec(ctx)
	})
	if err != nil || !sendNewCode {
		return response, err
	}
	return response, application.Delivery.DeliverOneTimeCode(ctx, destination, string(purpose), code)
}
