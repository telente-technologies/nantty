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

func requirePinnableSession(session *ent.LiveSession, actor types.Actor) error {
	if session.HostID != actor.UserId {
		return liveerrors.NotLiveHost
	}
	if session.State == livesession.StateEnded {
		return liveerrors.LiveNotActive
	}
	return nil
}

func (service *LiveService) PinProductToLive(ctx context.Context, actor types.Actor, liveId, productId uuid.UUID) ([]types.LiveProductView, error) {
	current, err := service.Client.LiveSession.Get(ctx, liveId)
	if ent.IsNotFound(err) {
		return nil, liveerrors.LiveNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := requirePinnableSession(current, actor); err != nil {
		return nil, err
	}
	product, err := service.requireLiveStoreProduct(ctx, current, actor.UserId, productId)
	if err != nil {
		return nil, err
	}
	err = service.RunInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := service.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if err := requirePinnableSession(session, actor); err != nil {
			return err
		}
		if err := tx.LiveProduct.Update().Where(liveproduct.LiveID(liveId), liveproduct.Pinned(true)).SetPinned(false).Exec(ctx); err != nil {
			return err
		}
		err = snapshotLiveProduct(tx.LiveProduct.Create().SetLiveID(liveId).SetProductID(productId).SetPinned(true).SetPinnedAt(service.Now()), product).
			OnConflictColumns(liveproduct.FieldLiveID, liveproduct.FieldProductID).
			UpdatePinned().UpdatePinnedAt().UpdateTitle().UpdatePriceMinor().UpdateCurrency().UpdateImageURL().Exec(ctx)
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
		views = append(views, presentLiveProduct(row))
	}
	return views, nil
}

func presentLiveProduct(row *ent.LiveProduct) types.LiveProductView {
	view := types.LiveProductView{ProductId: row.ProductID.String(), Pinned: row.Pinned, Title: row.Title, ImageUrl: row.ImageURL}
	if row.PriceMinor != nil && row.Currency != nil {
		view.Price = &types.MoneyView{AmountMinor: *row.PriceMinor, Currency: *row.Currency}
	}
	return view
}
