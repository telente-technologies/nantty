package application

import (
	"context"
	"strings"

	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/account"
)

type LogInWithPasswordInput struct {
	Identifier string
	Password   string
	Client     ClientDetails
}

func (application *AuthApplication) LogInWithEmailOrUsernameAndPassword(ctx context.Context, input LogInWithPasswordInput) (AuthenticationResult, error) {
	existing, err := application.findActiveAccountByEmailOrUsername(ctx, input.Identifier)
	if err != nil {
		return AuthenticationResult{}, err
	}
	if existing == nil || existing.PasswordHash == nil {
		application.Passwords.SpendEquivalentTimeWhenAccountIsMissing(input.Password)
		return AuthenticationResult{}, errInvalidCredentials
	}
	matches, err := application.Passwords.VerifyPasswordAgainstArgon2idHash(input.Password, *existing.PasswordHash)
	if err != nil || !matches {
		return AuthenticationResult{}, errInvalidCredentials
	}
	var session startedSession
	err = application.runInTransaction(ctx, func(tx *ent.Tx) error {
		if session, err = application.startSessionWithFirstRefreshTokenInTransaction(ctx, tx, existing.ID, input.Client); err != nil {
			return err
		}
		return enqueueOutboxEventInTransaction(ctx, tx, "account.loggedIn", existing.ID.String(), application.Now(), UserLoggedInEventData{
			AccountId: existing.ID.String(), SessionId: session.sessionId.String(), Method: "password",
		})
	})
	if err != nil {
		return AuthenticationResult{}, err
	}
	tokens, err := application.signAccessTokenAndBuildIssuedTokens(existing, session.sessionId, session.refreshToken)
	return AuthenticationResult{Tokens: tokens, Account: existing}, err
}

func (application *AuthApplication) findActiveAccountByEmailOrUsername(ctx context.Context, identifier string) (*ent.Account, error) {
	trimmed := strings.ToLower(strings.TrimSpace(identifier))
	predicate := account.Username(strings.TrimPrefix(trimmed, "@"))
	if strings.Contains(trimmed, "@") && !strings.HasPrefix(trimmed, "@") {
		predicate = account.Email(trimmed)
	}
	found, err := application.Client.Account.Query().Where(predicate, account.StatusEQ(account.StatusActive)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return found, err
}
