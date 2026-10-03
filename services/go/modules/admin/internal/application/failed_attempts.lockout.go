package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/admin/internal/ent"
	"zudomart/modules/admin/internal/ent/staffaccount"
)

func (application *AdminApplication) recordFailedAttemptAndMaybeLock(ctx context.Context, parsed uuid.UUID, rejection error) error {
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		staff, err := tx.StaffAccount.Query().Where(staffaccount.ID(parsed)).ForUpdate().Only(ctx)
		if err != nil {
			return err
		}
		attempts := staff.FailedAttempts + 1
		update := tx.StaffAccount.UpdateOneID(parsed)
		if attempts >= application.Settings.MaximumFailedPasswords {
			return update.SetFailedAttempts(0).SetLockedUntil(application.Now().Add(application.Settings.LockoutDuration)).Exec(ctx)
		}
		return update.SetFailedAttempts(attempts).Exec(ctx)
	})
	if err != nil {
		return err
	}
	return rejection
}
