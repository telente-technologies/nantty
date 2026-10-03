package application

import (
	"context"
	"errors"
	"strings"

	"zudomart/modules/auth/internal/ent"
	"zudomart/modules/auth/internal/ent/account"
	"zudomart/modules/auth/internal/ent/socialidentity"
	identity "zudomart/modules/auth/internal/socialidentity"
)

type SocialSignInInput struct {
	Provider identity.Provider
	Token    string
	Nonce    string
	FullName string
	Client   ClientDetails
}

func (application *AuthApplication) SignInWithVerifiedSocialIdentity(ctx context.Context, input SocialSignInInput) (AuthenticationResult, error) {
	verified, err := application.Social.VerifyIdentityToken(ctx, input.Provider, input.Token, input.Nonce, application.Now())
	if errors.Is(err, identity.ErrProviderNotConfigured) {
		return AuthenticationResult{}, errSocialSignInNotConfigured
	}
	if err != nil {
		application.Logger.WarnContext(ctx, "social identity token rejected", "provider", string(input.Provider), "reason", err.Error())
		return AuthenticationResult{}, errInvalidIdentityToken
	}
	var owner *ent.Account
	var session startedSession
	isNewUser := false
	err = application.runInTransaction(ctx, func(tx *ent.Tx) error {
		owner, isNewUser, err = application.findOrCreateAccountForSocialIdentityInTransaction(ctx, tx, verified, input.FullName)
		if err != nil {
			return err
		}
		if owner.Status != account.StatusActive {
			return errInvalidCredentials
		}
		if session, err = application.startSessionWithFirstRefreshTokenInTransaction(ctx, tx, owner.ID, input.Client); err != nil {
			return err
		}
		eventType, data := "account.loggedIn", any(UserLoggedInEventData{AccountId: owner.ID.String(), SessionId: session.sessionId.String(), Method: string(verified.Provider)})
		if isNewUser {
			eventType, data = "account.registered", AccountRegisteredEventData{
				AccountId: owner.ID.String(), Username: owner.Username, Name: owner.Name, Email: verified.Email, Method: string(verified.Provider),
			}
		}
		return enqueueOutboxEventInTransaction(ctx, tx, eventType, owner.ID.String(), application.Now(), data)
	})
	if err != nil {
		return AuthenticationResult{}, err
	}
	tokens, err := application.signAccessTokenAndBuildIssuedTokens(owner, session.sessionId, session.refreshToken)
	return AuthenticationResult{Tokens: tokens, Account: owner, IsNewUser: isNewUser}, err
}

func (application *AuthApplication) findOrCreateAccountForSocialIdentityInTransaction(ctx context.Context, tx *ent.Tx, verified identity.VerifiedIdentity, fullName string) (*ent.Account, bool, error) {
	linked, err := tx.SocialIdentity.Query().Where(socialidentity.ProviderEQ(socialidentity.Provider(verified.Provider)), socialidentity.Subject(verified.Subject)).Only(ctx)
	if err == nil {
		owner, err := tx.Account.Get(ctx, linked.AccountID)
		return owner, false, err
	}
	if !ent.IsNotFound(err) {
		return nil, false, err
	}
	if verified.Email == "" || !verified.EmailVerified {
		return nil, false, errSocialEmailNotVerified
	}
	owner, err := tx.Account.Query().Where(account.Email(verified.Email)).Only(ctx)
	created := ent.IsNotFound(err)
	if err != nil && !created {
		return nil, false, err
	}
	if created {
		if owner, err = application.createAccountForSocialIdentityInTransaction(ctx, tx, verified, fullName); err != nil {
			return nil, false, err
		}
	}
	err = tx.SocialIdentity.Create().SetAccountID(owner.ID).SetProvider(socialidentity.Provider(verified.Provider)).SetSubject(verified.Subject).SetEmail(verified.Email).Exec(ctx)
	return owner, created, mapUniqueViolationToConflict(err)
}

func (application *AuthApplication) createAccountForSocialIdentityInTransaction(ctx context.Context, tx *ent.Tx, verified identity.VerifiedIdentity, fullName string) (*ent.Account, error) {
	name := strings.TrimSpace(fullName)
	if name == "" {
		name = verified.Name
	}
	username, err := application.chooseAvailableUsername(ctx, tx.Client(), "", verified.Email, verified.Name)
	if err != nil {
		return nil, err
	}
	created, err := tx.Account.Create().
		SetEmail(verified.Email).SetUsername(username).SetName(truncateToLength(name, 80)).SetEmailVerifiedAt(application.Now()).
		Save(ctx)
	return created, mapUniqueViolationToConflict(err)
}
