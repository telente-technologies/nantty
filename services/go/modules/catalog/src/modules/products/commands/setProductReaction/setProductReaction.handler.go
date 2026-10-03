package setproductreaction

import (
	"context"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/product"
	"zudomart/modules/catalog/src/generated/ent/productreaction"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.Product.Query().Where(product.ID(command.ProductId)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return catalogerrors.ProductNotFound
		}
		if err != nil {
			return err
		}
		existing, err := tx.ProductReaction.Query().Where(productreaction.ProductID(row.ID), productreaction.AccountID(command.AccountId), productreaction.Kind(command.Kind)).Only(ctx)
		if err != nil && !ent.IsNotFound(err) {
			return err
		}
		exists := err == nil
		switch {
		case command.Active && !exists:
			if err := tx.ProductReaction.Create().SetProductID(row.ID).SetAccountID(command.AccountId).SetKind(command.Kind).Exec(ctx); err != nil {
				return err
			}
			return adjustLikes(ctx, row, command.Kind, 1)
		case !command.Active && exists:
			if err := tx.ProductReaction.DeleteOneID(existing.ID).Exec(ctx); err != nil {
				return err
			}
			return adjustLikes(ctx, row, command.Kind, -1)
		}
		return nil
	})
}

func adjustLikes(ctx context.Context, row *ent.Product, kind string, delta int) error {
	if kind != enums.ReactionLike {
		return nil
	}
	return row.Update().SetLikeCount(max(row.LikeCount+delta, 0)).Exec(ctx)
}
