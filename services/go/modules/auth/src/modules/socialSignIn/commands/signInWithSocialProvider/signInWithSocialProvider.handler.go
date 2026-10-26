package signinwithsocialprovider

import (
	"context"
	"errors"
	"strings"
	"time"

	"nantty/modules/auth/src/container"
	authErrors "nantty/modules/auth/src/errors"
	"nantty/modules/auth/src/events"
	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/account"
	"nantty/modules/auth/src/generated/ent/socialidentity"
	identity "nantty/modules/auth/src/integrations"
	"nantty/modules/auth/src/services"
	"nantty/modules/auth/src/types"
	"nantty/modules/auth/src/utils"
)

var errRefusedUnderMinimumAge = errors.New("refused under minimum age")

type Handler struct {
	*container.Container
}

func (application Handler) Execute(ctx context.Context, command Command) (types.AuthenticationResult, error) {
	verified, err := application.Social.VerifyIdentityToken(ctx, command.Provider, command.Token, command.Nonce, application.Now())
	if errors.Is(err, identity.ErrProviderNotConfigured) {
		return types.AuthenticationResult{}, authErrors.ErrSocialSignInNotConfigured
	}
	if err != nil {
		application.Logger.WarnContext(ctx, "social identity token rejected", "provider", string(command.Provider), "reason", err.Error())
		return types.AuthenticationResult{}, authErrors.ErrInvalidIdentityToken
	}
	var owner *ent.Account
	var session services.StartedSession
	isNewUser := false
	err = application.RunInTransaction(ctx, func(tx *ent.Tx) error {
		owner, isNewUser, err = application.findOrCreateAccountForSocialIdentityInTransaction(ctx, tx, verified, command)
		if err != nil {
			return err
		}
		if owner.Status == account.StatusBanned {
			return authErrors.ErrAccountBanned
		}
		if owner.Status != account.StatusActive && owner.Status != account.StatusSuspended {
			return authErrors.ErrInvalidCredentials
		}
		if session, err = services.StartSessionWithFirstRefreshTokenInTransaction(ctx, application.Container, tx, owner.ID, command.Client); err != nil {
			return err
		}
		eventType, data := "account.loggedIn", any(events.UserLoggedInEventData{AccountId: owner.ID.String(), SessionId: session.SessionId.String(), Method: string(verified.Provider)})
		if isNewUser {
			eventType, data = "account.registered", events.AccountRegisteredEventData{
				AccountId: owner.ID.String(), Username: owner.Username, Name: owner.Name, Email: verified.Email, Method: string(verified.Provider),
			}
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, eventType, owner.ID.String(), application.Now(), data)
	})
	if errors.Is(err, errRefusedUnderMinimumAge) {
		if recordErr := services.RecordAgeGateRefusal(ctx, application.Client, application.Settings.OneTimeCodePepper, verified.Email, command.Client.DeviceId, application.Now()); recordErr != nil {
			return types.AuthenticationResult{}, recordErr
		}
		return types.AuthenticationResult{}, authErrors.ErrBelowMinimumAge
	}
	if err != nil {
		return types.AuthenticationResult{}, err
	}
	tokens, err := services.SignAccessTokenAndBuildIssuedTokens(application.Container, owner, session.SessionId, session.RefreshToken)
	cancelled := !isNewUser && services.CancelPendingDeletionOnLogin(ctx, application.Container, owner.ID)
	return types.AuthenticationResult{Tokens: tokens, Account: owner, IsNewUser: isNewUser, DeletionCancelled: cancelled}, err
}

func (application Handler) findOrCreateAccountForSocialIdentityInTransaction(ctx context.Context, tx *ent.Tx, verified identity.VerifiedIdentity, command Command) (*ent.Account, bool, error) {
	linked, err := tx.SocialIdentity.Query().Where(socialidentity.ProviderEQ(socialidentity.Provider(verified.Provider)), socialidentity.Subject(verified.Subject)).Only(ctx)
	if err == nil {
		owner, err := tx.Account.Get(ctx, linked.AccountID)
		return owner, false, err
	}
	if !ent.IsNotFound(err) {
		return nil, false, err
	}
	if verified.Email == "" || !verified.EmailVerified {
		return nil, false, authErrors.ErrSocialEmailNotVerified
	}
	owner, err := tx.Account.Query().Where(account.Email(verified.Email)).Only(ctx)
	created := ent.IsNotFound(err)
	if err != nil && !created {
		return nil, false, err
	}
	if created {
		if err := services.AssertSignupIsNotBlockedInTransaction(ctx, tx, application.Settings.OneTimeCodePepper, verified.Email, command.Client.DeviceId); err != nil {
			return nil, false, err
		}
		birthday, err := application.parseNewSocialAccountBirthday(ctx, tx, verified.Email, command)
		if err != nil {
			return nil, false, err
		}
		if owner, err = application.createAccountForSocialIdentityInTransaction(ctx, tx, verified, command.FullName, birthday); err != nil {
			return nil, false, err
		}
	}
	err = tx.SocialIdentity.Create().SetAccountID(owner.ID).SetProvider(socialidentity.Provider(verified.Provider)).SetSubject(verified.Subject).SetEmail(verified.Email).Exec(ctx)
	return owner, created, services.MapUniqueViolationToConflict(err)
}

func (application Handler) parseNewSocialAccountBirthday(ctx context.Context, tx *ent.Tx, email string, command Command) (time.Time, error) {
	if err := services.AssertNoRecentAgeGateRefusal(ctx, tx.Client(), application.Settings.OneTimeCodePepper, email, command.Client.DeviceId, application.Now()); err != nil {
		return time.Time{}, err
	}
	if strings.TrimSpace(command.Birthday) == "" {
		return time.Time{}, authErrors.ErrBirthdayRequired
	}
	birthday, err := utils.ParseBirthday(command.Birthday, application.Now())
	if err != nil {
		return time.Time{}, err
	}
	if utils.IsBelowMinimumAccountAge(birthday, application.Now()) {
		return time.Time{}, errRefusedUnderMinimumAge
	}
	return birthday, nil
}

func (application Handler) createAccountForSocialIdentityInTransaction(ctx context.Context, tx *ent.Tx, verified identity.VerifiedIdentity, fullName string, birthday time.Time) (*ent.Account, error) {
	name := strings.TrimSpace(fullName)
	if name == "" {
		name = verified.Name
	}
	username, err := services.ChooseAvailableUsername(ctx, tx.Client(), "", verified.Email, verified.Name)
	if err != nil {
		return nil, err
	}
	created, err := tx.Account.Create().
		SetEmail(verified.Email).SetUsername(username).SetName(utils.TruncateToLength(name, 80)).SetBirthday(birthday).SetEmailVerifiedAt(application.Now()).
		Save(ctx)
	return created, services.MapUniqueViolationToConflict(err)
}
