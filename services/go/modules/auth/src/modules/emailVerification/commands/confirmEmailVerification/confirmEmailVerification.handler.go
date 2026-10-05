package confirmemailverification

import (
	"context"
	"crypto/subtle"
	"net/http"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/container"
	authErrors "zudomart/modules/auth/src/errors"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/onetimecode"
	sendemailverificationcode "zudomart/modules/auth/src/modules/emailVerification/commands/sendEmailVerificationCode"
	"zudomart/modules/auth/src/modules/emailVerification/dtos"
	"zudomart/modules/auth/src/utils"
	"zudomart/platform/httpserver"
)

var ErrCodeNotSent = httpserver.NewApiError(http.StatusConflict, "CODE_NOT_SENT", "Request a verification code first.")

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) (dtos.EmailVerifiedResponse, error) {
	accountId, err := uuid.Parse(command.AccountId)
	if err != nil {
		return dtos.EmailVerifiedResponse{}, authErrors.ErrInvalidCredentials
	}
	var outcome error
	var email string
	err = application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		existing, err := tx.Account.Get(ctx, accountId)
		if err != nil {
			return err
		}
		if existing.Email == nil || *existing.Email == "" {
			outcome = sendemailverificationcode.ErrEmailMissing
			return nil
		}
		email = *existing.Email
		if existing.EmailVerifiedAt != nil {
			outcome = sendemailverificationcode.ErrAlreadyVerified
			return nil
		}
		now := application.Now()
		purpose := onetimecode.PurposeEmailVerification
		active, err := tx.OneTimeCode.Query().Where(onetimecode.Destination(email), onetimecode.PurposeEQ(purpose), onetimecode.ConsumedAtIsNil(), onetimecode.ExpiresAtGT(now)).
			Order(ent.Desc(onetimecode.FieldCreatedAt)).ForUpdate().First(ctx)
		if ent.IsNotFound(err) {
			outcome = ErrCodeNotSent
			return nil
		}
		if err != nil {
			return err
		}
		expected := utils.HashOneTimeCodeWithPepper(application.Settings.OneTimeCodePepper, email, string(purpose), command.Code)
		if subtle.ConstantTimeCompare([]byte(expected), []byte(active.SecretHash)) != 1 {
			outcome = authErrors.ErrInvalidOneTimeCode
			update := active.Update().AddFailedAttempts(1)
			if active.FailedAttempts+1 >= application.Settings.OneTimeCodeMaximumAttempts {
				update, outcome = update.SetConsumedAt(now), authErrors.ErrTooManyCodeAttempts
			}
			return update.Exec(ctx)
		}
		if err := active.Update().SetConsumedAt(now).Exec(ctx); err != nil {
			return err
		}
		return tx.Account.UpdateOneID(accountId).SetEmailVerifiedAt(now).Exec(ctx)
	})
	if ent.IsNotFound(err) {
		return dtos.EmailVerifiedResponse{}, authErrors.ErrInvalidCredentials
	}
	if err != nil {
		return dtos.EmailVerifiedResponse{}, err
	}
	if outcome != nil {
		return dtos.EmailVerifiedResponse{}, outcome
	}
	return dtos.EmailVerifiedResponse{Email: email, EmailVerified: true}, nil
}
