package loginwithpassword

import (
	"context"
	"strings"

	"zudomart/modules/auth/src/container"
	authErrors "zudomart/modules/auth/src/errors"
	"zudomart/modules/auth/src/events"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/account"
	"zudomart/modules/auth/src/services"
	"zudomart/modules/auth/src/types"
	"zudomart/platform/usernames"
)

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) (types.AuthenticationResult, error) {
	existing, err := application.findActiveAccountByEmailOrUsername(ctx, command.Identifier)
	if err != nil {
		return types.AuthenticationResult{}, err
	}
	if existing == nil || existing.PasswordHash == nil {
		application.Passwords.SpendEquivalentTimeWhenAccountIsMissing(command.Password)
		return types.AuthenticationResult{}, authErrors.ErrInvalidCredentials
	}
	matches, err := application.Passwords.VerifyPasswordAgainstArgon2idHash(command.Password, *existing.PasswordHash)
	if err != nil || !matches {
		return types.AuthenticationResult{}, authErrors.ErrInvalidCredentials
	}
	if existing.Status == account.StatusBanned {
		return types.AuthenticationResult{}, authErrors.ErrAccountBanned
	}
	reactivating := existing.Status == account.StatusDeactivated
	if reactivating {
		if err := services.AssertDeactivatedAccountMayReturn(ctx, existing.ID); err != nil {
			return types.AuthenticationResult{}, err
		}
	}
	var session services.StartedSession
	err = application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if reactivating {
			if err := services.ReactivateAccountInTransaction(ctx, tx, existing.ID, application.Now()); err != nil {
				return err
			}
			existing.Status = account.StatusActive
		}
		if err := services.AnnounceNewDeviceInTransaction(ctx, application.Container, tx, existing.ID, command.Client); err != nil {
			return err
		}
		if session, err = services.StartSessionWithFirstRefreshTokenInTransaction(ctx, application.Container, tx, existing.ID, command.Client); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "account.loggedIn", existing.ID.String(), application.Now(), events.UserLoggedInEventData{
			AccountId: existing.ID.String(), SessionId: session.SessionId.String(), Method: "password",
		})
	})
	if err != nil {
		return types.AuthenticationResult{}, err
	}
	tokens, err := services.SignAccessTokenAndBuildIssuedTokens(application.Container, existing, session.SessionId, session.RefreshToken)
	cancelled := services.CancelPendingDeletionOnLogin(ctx, application.Container, existing.ID)
	return types.AuthenticationResult{Tokens: tokens, Account: existing, DeletionCancelled: cancelled, Reactivated: reactivating}, err
}

func normalizeLoginIdentifier(identifier string) (value string, isEmail bool) {
	trimmed := strings.ToLower(strings.TrimSpace(identifier))
	if strings.Contains(trimmed, "@") && !strings.HasPrefix(trimmed, "@") {
		return trimmed, true
	}
	return usernames.NormalizeRequestedUsername(identifier), false
}

func (application Handler) findActiveAccountByEmailOrUsername(ctx context.Context, identifier string) (*ent.Account, error) {
	value, isEmail := normalizeLoginIdentifier(identifier)
	predicate := account.Username(value)
	if isEmail {
		predicate = account.Email(value)
	}
	found, err := application.Client.Account.Query().Where(predicate, account.StatusIn(account.StatusActive, account.StatusSuspended, account.StatusBanned, account.StatusDeactivated)).Only(ctx)
	if ent.IsNotFound(err) {
		return nil, nil
	}
	return found, err
}
