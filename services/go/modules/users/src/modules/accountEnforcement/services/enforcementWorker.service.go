package services

import (
	"context"
	"time"

	"nantty/modules/users/src/container"
	"nantty/modules/users/src/generated/ent/accountban"
	"nantty/modules/users/src/generated/ent/accountsuspension"
	"nantty/modules/users/src/types"
)

type EnforcementWorker struct {
	Container *container.Container
}

func (worker EnforcementWorker) RunOnce(ctx context.Context) error {
	now := worker.Container.Now()
	system := types.StaffActor{}
	expiredSuspensions, err := worker.Container.Client.AccountSuspension.Query().Where(accountsuspension.StatusEQ(accountsuspension.StatusActive), accountsuspension.EndsAtLTE(now)).Limit(20).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range expiredSuspensions {
		target, err := LoadTarget(ctx, worker.Container, row.AccountID.String())
		if err != nil {
			return err
		}
		if err := CloseActiveSuspension(ctx, worker.Container, target, system, "suspension period ended", "expired", "", ""); err != nil {
			return err
		}
	}
	expiredBans, err := worker.Container.Client.AccountBan.Query().Where(accountban.LiftedAtIsNil(), accountban.EndsAtLTE(now)).Limit(20).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range expiredBans {
		target, err := LoadTarget(ctx, worker.Container, row.AccountID.String())
		if err != nil {
			return err
		}
		if err := LiftActiveBan(ctx, worker.Container, target, system, "ban period ended", ""); err != nil {
			return err
		}
	}
	return worker.deleteDueSuspendedAccounts(ctx, now)
}

func (worker EnforcementWorker) deleteDueSuspendedAccounts(ctx context.Context, now time.Time) error {
	due, err := worker.Container.Client.AccountSuspension.Query().Where(accountsuspension.StatusEQ(accountsuspension.StatusActive), accountsuspension.DeletionDueAtLTE(now)).Limit(10).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range due {
		target, err := LoadTarget(ctx, worker.Container, row.AccountID.String())
		if err != nil {
			return err
		}
		if _, err := RemoveAccountDataAndAnonymize(ctx, worker.Container, row.AccountID, target.Account.Username, emailText(target.Account.Email), "suspension_expired", "120-day suspension period ended", "system"); err != nil {
			return err
		}
		if err := row.Update().SetStatus(accountsuspension.StatusDeleted).SetClosedAt(now).Exec(ctx); err != nil {
			return err
		}
	}
	return nil
}

func emailText(email *string) string {
	if email == nil {
		return ""
	}
	return *email
}
