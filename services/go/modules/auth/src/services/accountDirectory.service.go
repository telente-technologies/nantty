package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/auth/src/container"
	"zudomart/modules/auth/src/events"
	"zudomart/modules/auth/src/generated/ent"
	"zudomart/modules/auth/src/generated/ent/account"
	"zudomart/modules/auth/src/generated/ent/session"
	"zudomart/platform/identityports"
)

type AccountDirectoryService struct {
	Container *container.Container
}

func (application AccountDirectoryService) FindAccountSummary(ctx context.Context, accountId uuid.UUID) (identityports.AccountSummary, bool, error) {
	return application.summarize(application.Container.Client.Account.Get(ctx, accountId))
}

func (application AccountDirectoryService) FindAccountSummaryByUsername(ctx context.Context, username string) (identityports.AccountSummary, bool, error) {
	return application.summarize(application.Container.Client.Account.Query().Where(account.Username(username)).Only(ctx))
}

func (application AccountDirectoryService) summarize(found *ent.Account, err error) (identityports.AccountSummary, bool, error) {
	if ent.IsNotFound(err) {
		return identityports.AccountSummary{}, false, nil
	}
	if err != nil {
		return identityports.AccountSummary{}, false, err
	}
	return identityports.AccountSummary{
		ID: found.ID, Username: found.Username, Name: found.Name, Email: found.Email, Birthday: found.Birthday, Roles: found.Roles,
		EmailVerified: found.EmailVerifiedAt != nil, Active: found.Status == account.StatusActive, Status: string(found.Status), CreatedAt: found.CreatedAt,
	}, true, nil
}

func (application AccountDirectoryService) IsUsernameTaken(ctx context.Context, username string, excludingAccountId uuid.UUID) (bool, error) {
	return application.Container.Client.Account.Query().Where(account.Username(username), account.IDNEQ(excludingAccountId)).Exist(ctx)
}

func (application AccountDirectoryService) RenameAccountUsername(ctx context.Context, accountId uuid.UUID, username string) error {
	err := application.Container.Client.Account.UpdateOneID(accountId).SetUsername(username).Exec(ctx)
	if ent.IsConstraintError(err) {
		return identityports.ErrUsernameAlreadyTaken
	}
	return err
}

func (application AccountDirectoryService) DeactivateAccountAndRevokeSessions(ctx context.Context, accountId uuid.UUID) error {
	return application.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		now := application.Container.Now()
		if err := tx.Account.UpdateOneID(accountId).SetStatus(account.StatusDeactivated).Exec(ctx); err != nil {
			return err
		}
		if _, err := tx.Session.Update().Where(session.AccountID(accountId), session.RevokedAtIsNil()).SetRevokedAt(now).SetRevokedReason(session.RevokedReasonRevokeAll).Save(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "account.deactivated", accountId.String(), now, events.AccountDeactivatedEventData{AccountId: accountId.String()})
	})
}
