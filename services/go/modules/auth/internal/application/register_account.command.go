package application

import (
	"context"
	"strings"

	"zudomart/modules/auth/internal/ent"
	"zudomart/modules/auth/internal/ent/account"
	"zudomart/modules/auth/internal/ent/onetimecode"
)

type RegisterAccountInput struct {
	Email    string
	Birthday string
	Password string
	Username string
	Name     string
	OtpToken string
	Client   ClientDetails
}

func (application *AuthApplication) RegisterAccountWithVerifiedEmail(ctx context.Context, input RegisterAccountInput) (AuthenticationResult, error) {
	email, valid := NormalizeEmailAddress(input.Email)
	if !valid {
		return AuthenticationResult{}, unprocessable("Enter a valid email address.")
	}
	if err := AssertPasswordMeetsPolicy(input.Password); err != nil {
		return AuthenticationResult{}, err
	}
	birthday, err := ParseBirthdayAndAssertMinimumAge(input.Birthday, application.Now())
	if err != nil {
		return AuthenticationResult{}, err
	}
	passwordHash, err := application.Passwords.HashPasswordWithArgon2id(input.Password)
	if err != nil {
		return AuthenticationResult{}, err
	}
	var created *ent.Account
	var session startedSession
	err = application.runInTransaction(ctx, func(tx *ent.Tx) error {
		verifiedEmail, err := consumeVerifiedDestinationTokenInTransaction(ctx, tx, onetimecode.PurposeSignupVerified, input.OtpToken, application.Now)
		if err != nil {
			return err
		}
		if verifiedEmail != email {
			return errDestinationNotProven
		}
		if taken, err := tx.Account.Query().Where(account.Email(email)).Exist(ctx); err != nil || taken {
			return firstError(err, errEmailAlreadyInUse)
		}
		username, err := application.chooseAvailableUsername(ctx, tx.Client(), strings.TrimSpace(input.Username), email)
		if err != nil {
			return err
		}
		now := application.Now()
		created, err = tx.Account.Create().
			SetEmail(email).SetUsername(username).SetPasswordHash(passwordHash).
			SetName(strings.TrimSpace(input.Name)).SetBirthday(birthday).SetEmailVerifiedAt(now).
			Save(ctx)
		if err != nil {
			return mapUniqueViolationToConflict(err)
		}
		if session, err = application.startSessionWithFirstRefreshTokenInTransaction(ctx, tx, created.ID, input.Client); err != nil {
			return err
		}
		return enqueueOutboxEventInTransaction(ctx, tx, "account.registered", created.ID.String(), now, AccountRegisteredEventData{
			AccountId: created.ID.String(), Username: created.Username, Name: created.Name, Email: email, Method: "password",
		})
	})
	if err != nil {
		return AuthenticationResult{}, err
	}
	tokens, err := application.signAccessTokenAndBuildIssuedTokens(created, session.sessionId, session.refreshToken)
	return AuthenticationResult{Tokens: tokens, Account: created, IsNewUser: true}, err
}

func mapUniqueViolationToConflict(err error) error {
	if !ent.IsConstraintError(err) {
		return err
	}
	if strings.Contains(err.Error(), "username") {
		return errUsernameAlreadyInUse
	}
	return errEmailAlreadyInUse
}

func firstError(err error, fallback error) error {
	if err != nil {
		return err
	}
	return fallback
}
