package registeraccount

import (
	"context"
	"errors"
	"strings"

	"zudomart/modules/auth/src/container"
	authErrors "zudomart/modules/auth/src/errors"
	"zudomart/modules/auth/src/events"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/account"
	"zudomart/modules/auth/src/generated/ent/onetimecode"
	"zudomart/modules/auth/src/services"
	"zudomart/modules/auth/src/types"
	"zudomart/modules/auth/src/utils"
)

var errRefusedUnderMinimumAge = errors.New("refused under minimum age")

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) (types.AuthenticationResult, error) {
	email, valid := utils.NormalizeEmailAddress(command.Email)
	if !valid {
		return types.AuthenticationResult{}, authErrors.Unprocessable("Enter a valid email address.")
	}
	if err := utils.AssertPasswordMeetsPolicy(command.Password); err != nil {
		return types.AuthenticationResult{}, err
	}
	birthday, err := utils.ParseBirthday(command.Birthday, application.Now())
	if err != nil {
		return types.AuthenticationResult{}, err
	}
	passwordHash, err := application.Passwords.HashPasswordWithArgon2id(command.Password)
	if err != nil {
		return types.AuthenticationResult{}, err
	}
	var created *ent.Account
	var session services.StartedSession
	err = application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		verifiedEmail, err := services.ConsumeVerifiedDestinationTokenInTransaction(ctx, tx, onetimecode.PurposeSignupVerified, command.OtpToken, application.Now)
		if err != nil {
			return err
		}
		if verifiedEmail != email {
			return authErrors.ErrDestinationNotProven
		}
		if err := services.AssertSignupIsNotBlockedInTransaction(ctx, tx, application.Settings.OneTimeCodePepper, email, command.Client.DeviceId); err != nil {
			return err
		}
		if err := services.AssertNoRecentAgeGateRefusal(ctx, tx.Client(), application.Settings.OneTimeCodePepper, email, command.Client.DeviceId, application.Now()); err != nil {
			return err
		}
		if utils.IsBelowMinimumAccountAge(birthday, application.Now()) {
			return errRefusedUnderMinimumAge
		}
		if taken, err := tx.Account.Query().Where(account.Email(email)).Exist(ctx); err != nil || taken {
			return services.FirstError(err, authErrors.ErrEmailAlreadyInUse)
		}
		username, err := services.ChooseAvailableUsername(ctx, tx.Client(), strings.TrimSpace(command.Username), email)
		if err != nil {
			return err
		}
		now := application.Now()
		created, err = tx.Account.Create().
			SetEmail(email).SetUsername(username).SetPasswordHash(passwordHash).
			SetName(strings.TrimSpace(command.Name)).SetBirthday(birthday).SetEmailVerifiedAt(now).
			Save(ctx)
		if err != nil {
			return services.MapUniqueViolationToConflict(err)
		}
		if session, err = services.StartSessionWithFirstRefreshTokenInTransaction(ctx, application.Container, tx, created.ID, command.Client); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "account.registered", created.ID.String(), now, events.AccountRegisteredEventData{
			AccountId: created.ID.String(), Username: created.Username, Name: created.Name, Email: email, Method: "password",
		})
	})
	if errors.Is(err, errRefusedUnderMinimumAge) {
		if recordErr := services.RecordAgeGateRefusal(ctx, application.Client, application.Settings.OneTimeCodePepper, email, command.Client.DeviceId, application.Now()); recordErr != nil {
			return types.AuthenticationResult{}, recordErr
		}
		return types.AuthenticationResult{}, authErrors.ErrBelowMinimumAge
	}
	if err != nil {
		return types.AuthenticationResult{}, services.AttachUsernameSuggestions(ctx, application.Client, application.Now(), err, command.Username, command.Name, email)
	}
	tokens, err := services.SignAccessTokenAndBuildIssuedTokens(application.Container, created, session.SessionId, session.RefreshToken)
	return types.AuthenticationResult{Tokens: tokens, Account: created, IsNewUser: true}, err
}
