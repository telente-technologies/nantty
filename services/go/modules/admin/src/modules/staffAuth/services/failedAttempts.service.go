package services

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/admin/src/generated/ent"
	"nantty/modules/admin/src/generated/ent/staffaccount"
)

func (service StaffAuthService) RecordFailedPasswordAttemptAndMaybeLock(ctx context.Context, staffId uuid.UUID, rejection error) error {
	err := service.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		staff, err := tx.StaffAccount.Query().Where(staffaccount.ID(staffId)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		return service.applyFailedAttemptInTransaction(ctx, tx, staff)
	})
	if err != nil {
		return err
	}
	return rejection
}

func (service StaffAuthService) applyFailedAttemptInTransaction(ctx context.Context, tx *ent.Tx, staff *ent.StaffAccount) error {
	attempts := staff.FailedAttempts + 1
	update := tx.StaffAccount.UpdateOneID(staff.ID)
	if attempts >= service.Container.Settings.MaximumFailedPasswords {
		return update.SetFailedAttempts(0).SetLockedUntil(service.Container.Now().Add(service.Container.Settings.LockoutDuration)).Exec(ctx)
	}
	return update.SetFailedAttempts(attempts).Exec(ctx)
}

func (service StaffAuthService) CountFailedStepUpInTransaction(ctx context.Context, tx *ent.Tx, staff *ent.StaffAccount) (lockedOut bool, err error) {
	lockedOut = staff.FailedAttempts+1 >= service.Container.Settings.MaximumFailedPasswords
	return lockedOut, service.applyFailedAttemptInTransaction(ctx, tx, staff)
}
