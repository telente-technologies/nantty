package transferbrand

import (
	"context"
	"sort"

	"github.com/google/uuid"

	"zudomart/modules/users/src/container"
	usersErrors "zudomart/modules/users/src/errors"
	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/linkedprofile"
	usersservices "zudomart/modules/users/src/services"
)

type Command struct {
	BrandId       uuid.UUID
	FromAccountId uuid.UUID
	ToAccountId   uuid.UUID
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	if command.FromAccountId == command.ToAccountId {
		return usersErrors.Conflict("NO_CHANGE", "That account already owns the brand.")
	}
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		accounts := []uuid.UUID{command.FromAccountId, command.ToAccountId}
		sort.Slice(accounts, func(left, right int) bool { return accounts[left].String() < accounts[right].String() })
		for _, accountId := range accounts {
			if err := usersservices.LockLinkedProfilesOfAccount(ctx, tx, accountId); err != nil {
				return err
			}
		}
		taken, err := tx.LinkedProfile.Query().Where(linkedprofile.AccountID(command.ToAccountId), linkedprofile.KindEQ(linkedprofile.KindBrand), linkedprofile.StatusEQ(linkedprofile.StatusActive)).Exist(ctx)
		if err != nil {
			return err
		}
		if taken {
			return usersErrors.ErrProfileLimitOneBrand
		}
		row, err := tx.LinkedProfile.Query().Where(linkedprofile.KindEQ(linkedprofile.KindBrand), linkedprofile.ProfileID(command.BrandId)).Only(ctx)
		if ent.IsNotFound(err) {
			return tx.LinkedProfile.Create().SetAccountID(command.ToAccountId).SetKind(linkedprofile.KindBrand).SetProfileID(command.BrandId).Exec(ctx)
		}
		if err != nil {
			return err
		}
		if row.AccountID != command.FromAccountId {
			return usersErrors.ErrProfileNotFound
		}
		return row.Update().SetAccountID(command.ToAccountId).SetStatus(linkedprofile.StatusActive).ClearHoldReason().Exec(ctx)
	})
}
