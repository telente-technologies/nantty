package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/account"
	"zudomart/modules/auth/src/generated/ent/session"
	"zudomart/platform/identityports"
)

type UsernameChangedEventData struct {
	AccountId string `json:"accountId"`
	Username  string `json:"username"`
}

type AccountDeactivatedEventData struct {
	AccountId string `json:"accountId"`
}

func (application *AuthApplication) FindAccountSummary(ctx context.Context, accountId uuid.UUID) (identityports.AccountSummary, bool, error) {
	found, err := application.Client.Account.Get(ctx, accountId)
	if ent.IsNotFound(err) {
		return identityports.AccountSummary{}, false, nil
	}
	if err != nil {
		return identityports.AccountSummary{}, false, err
	}
	return identityports.AccountSummary{
		ID: found.ID, Username: found.Username, Name: found.Name, Email: found.Email, Birthday: found.Birthday, Roles: found.Roles,
		EmailVerified: found.EmailVerifiedAt != nil, Active: found.Status == account.StatusActive, CreatedAt: found.CreatedAt,
	}, true, nil
}

func (application *AuthApplication) IsUsernameTaken(ctx context.Context, username string, excludingAccountId uuid.UUID) (bool, error) {
	return application.Client.Account.Query().Where(account.Username(username), account.IDNEQ(excludingAccountId)).Exist(ctx)
}

func (application *AuthApplication) RenameAccountUsername(ctx context.Context, accountId uuid.UUID, username string) error {
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		if err := tx.Account.UpdateOneID(accountId).SetUsername(username).Exec(ctx); err != nil {
			if ent.IsConstraintError(err) {
				return identityports.ErrUsernameAlreadyTaken
			}
			return err
		}
		return enqueueOutboxEventInTransaction(ctx, tx, "account.usernameChanged", accountId.String(), application.Now(), UsernameChangedEventData{AccountId: accountId.String(), Username: username})
	})
}

func (application *AuthApplication) DeactivateAccountAndRevokeSessions(ctx context.Context, accountId uuid.UUID) error {
	return application.runInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Now()
		if err := tx.Account.UpdateOneID(accountId).SetStatus(account.StatusDeactivated).Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.Session.Update().Where(session.AccountID(accountId), session.RevokedAtIsNil()).SetRevokedAt(now).SetRevokedReason(session.RevokedReasonRevokeAll).Save(ctx); err != nil {
			return err
		}
		return enqueueOutboxEventInTransaction(ctx, tx, "account.deactivated", accountId.String(), now, AccountDeactivatedEventData{AccountId: accountId.String()})
	})
}
