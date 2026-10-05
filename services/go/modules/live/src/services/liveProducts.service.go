package services

import (
	"context"
	liveerrors "zudomart/modules/live/src/errors"
	"zudomart/modules/live/src/types"

	"github.com/google/uuid"

	"zudomart/modules/live/src/generated/ent"
	"zudomart/modules/live/src/generated/ent/liveproduct"
	"zudomart/modules/live/src/generated/ent/livesession"
)

func (service *LiveService) PinProductToLive(ctx context.Context, actor types.Actor, liveId, productId uuid.UUID) ([]types.LiveProductView, error) {
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if session.HostID != actor.UserId {
			return liveerrors.NotLiveHost
		}
		if session.State == livesession.StateEnded {
			return liveerrors.LiveNotActive
		}
		if err := service.PinPolicy.CanPinProducts(ctx, actor.UserId, actor.Roles, []uuid.UUID{productId}); err != nil {
			return err
		}
		if err := tx.LiveProduct.Update().Where(liveproduct.LiveID(liveId), liveproduct.Pinned(true)).SetPinned(false).Exec(ctx); err != nil {
			return err
		}
		err = tx.LiveProduct.Create().SetLiveID(liveId).SetProductID(productId).SetPinned(true).SetPinnedAt(service.Now()).
			OnConflictColumns(liveproduct.FieldLiveID, liveproduct.FieldProductID).UpdatePinned().UpdatePinnedAt().Exec(ctx)
		if err != nil {
			return err
		}
		return session.Update().SetPinnedProductID(productId).Exec(ctx)
	})
	if err != nil {
		return nil, err
	}
	return service.ListLiveProducts(ctx, liveId)
}

func (service *LiveService) UnpinProductFromLive(ctx context.Context, actor types.Actor, liveId uuid.UUID) ([]types.LiveProductView, error) {
	err := service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if session.HostID != actor.UserId {
			return liveerrors.NotLiveHost
		}
		if err := tx.LiveProduct.Update().Where(liveproduct.LiveID(liveId), liveproduct.Pinned(true)).SetPinned(false).Exec(ctx); err != nil {
			return err
		}
		return session.Update().ClearPinnedProductID().Exec(ctx)
	})
	if err != nil {
		return nil, err
	}
	return service.ListLiveProducts(ctx, liveId)
}

func (service *LiveService) ListLiveProducts(ctx context.Context, liveId uuid.UUID) ([]types.LiveProductView, error) {
	rows, err := service.Client.LiveProduct.Query().Where(liveproduct.LiveID(liveId)).Order(ent.Asc(liveproduct.FieldCreatedAt)).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]types.LiveProductView, 0, len(rows))
	for _, row := range rows {
		views = append(views, types.LiveProductView{ProductId: row.ProductID.String(), Pinned: row.Pinned})
	}
	return views, nil
}

type RolesProductPinPolicy struct{}

func (RolesProductPinPolicy) CanPinProducts(_ context.Context, _ uuid.UUID, roles []string, _ []uuid.UUID) error {
	for _, role := range roles {
		if role == "seller" {
			return nil
		}
	}
	return liveerrors.Unprocessable("PRODUCTS_REQUIRE_STORE", "Only accounts with a store can pin products.")
}
