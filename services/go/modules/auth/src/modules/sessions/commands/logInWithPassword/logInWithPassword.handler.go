package loginwithpassword

import (
	"context"
	"strings"
	"time"

	"nantty/modules/auth/src/container"
	authErrors "nantty/modules/auth/src/errors"
	"nantty/modules/auth/src/events"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/account"
	"nantty/modules/auth/src/services"
	"nantty/modules/auth/src/types"
	"nantty/platform/loginthrottle"
	"nantty/platform/usernames"
)

var passwordFailures = loginthrottle.New(10, 15*time.Minute, 15*time.Minute)

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) (types.AuthenticationResult, error) {
	existing, err := application.VerifyCredentials(ctx, command.Identifier, command.Password)
	if err != nil {
		return types.AuthenticationResult{}, err
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

// VerifyCredentials validates an existing Nantty password without issuing a
// session. Messenger uses this before creating a pending device authorization.
func (application Handler) VerifyCredentials(ctx context.Context, identifier, password string) (*ent.Account, error) {
	throttleKey, _ := normalizeLoginIdentifier(identifier)
	if passwordFailures.LockedFor(throttleKey) > 0 {
		return nil, authErrors.ErrTooManyLoginAttempts
	}
	existing, err := application.findActiveAccountByEmailOrUsername(ctx, identifier)
	if err != nil {
		return nil, err
	}
	if existing == nil || existing.PasswordHash == nil {
		application.Passwords.SpendEquivalentTimeWhenAccountIsMissing(password)
		passwordFailures.RecordFailure(throttleKey)
		return nil, authErrors.ErrInvalidCredentials
	}
	matches, err := application.Passwords.VerifyPasswordAgainstArgon2idHash(password, *existing.PasswordHash)
	if err != nil || !matches {
		passwordFailures.RecordFailure(throttleKey)
		return nil, authErrors.ErrInvalidCredentials
	}
	passwordFailures.RecordSuccess(throttleKey)
	return existing, nil
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
