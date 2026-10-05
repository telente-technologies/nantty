package setfollow

import (
	"context"
	"database/sql"
	"errors"

	"zudomart/modules/catalog/src/container"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/events"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/brand"
	"zudomart/modules/catalog/src/generated/ent/catalogfollow"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		if err := handler.checkTarget(ctx, tx, command); err != nil {
			return err
		}
		if !command.Follow {
			removed, err := tx.CatalogFollow.Delete().Where(catalogfollow.TargetKind(command.TargetKind), catalogfollow.TargetID(command.TargetId), catalogfollow.AccountID(command.AccountId)).Exec(ctx)
			if err != nil || removed == 0 {
				return err
			}
			return handler.adjustCount(ctx, tx, command, -1)
		}
		err := tx.CatalogFollow.Create().SetTargetKind(command.TargetKind).SetTargetID(command.TargetId).SetAccountID(command.AccountId).
			OnConflictColumns(catalogfollow.FieldTargetKind, catalogfollow.FieldTargetID, catalogfollow.FieldAccountID).DoNothing().Exec(ctx)
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		if err := handler.adjustCount(ctx, tx, command, 1); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, command.TargetKind+".followed", command.TargetId.String(), handler.Container.Now(), map[string]any{
			command.TargetKind + "Id": command.TargetId, "followerAccountId": command.AccountId,
		})
	})
}

func (handler Handler) checkTarget(ctx context.Context, tx *ent.Tx, command Command) error {
	row, err := tx.Brand.Query().Where(brand.ID(command.TargetId), brand.Active(true)).Only(ctx)
	if ent.IsNotFound(err) {
		return catalogerrors.NotFound
	}
	if err == nil && command.Follow && row.OwnerAccountID != nil && *row.OwnerAccountID == command.AccountId {
		return catalogerrors.CannotFollowOwn
	}
	return err
}

func (handler Handler) adjustCount(ctx context.Context, tx *ent.Tx, command Command, delta int) error {
	return tx.Brand.UpdateOneID(command.TargetId).AddFollowerCount(delta).Exec(ctx)
}
