package application

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/live/internal/ent"
	"zudomart/modules/live/internal/ent/liveproduct"
	"zudomart/modules/live/internal/ent/livesession"
)

type LiveProductView struct {
	ProductId string `json:"productId"`
	Pinned    bool   `json:"pinned"`
}

func (application *LiveApplication) PinProductToLive(ctx context.Context, actor Actor, liveId, productId uuid.UUID) ([]LiveProductView, error) {
	err := application.runInTransaction(ctx, func(tx *ent.Tx) error {
		session, err := application.lockLiveSession(ctx, tx, liveId)
		if err != nil {
			return err
		}
		if session.HostID != actor.UserId {
			return errNotLiveHost
		}
		if session.State == livesession.StateEnded {
			return errLiveNotActive
		}
		if err := application.PinPolicy.CanPinProducts(ctx, actor.UserId, actor.Roles, []uuid.UUID{productId}); err != nil {
			return err
		}
		if err := tx.LiveProduct.Update().Where(liveproduct.LiveID(liveId), liveproduct.Pinned(true)).SetPinned(false).Exec(ctx); err != nil {
			return err
		}
		err = tx.LiveProduct.Create().SetLiveID(liveId).SetProductID(productId).SetPinned(true).SetPinnedAt(application.Now()).
			OnConflictColumns(liveproduct.FieldLiveID, liveproduct.FieldProductID).UpdatePinned().UpdatePinnedAt().Exec(ctx)
		if err != nil {
			return err
		}
		return session.Update().SetPinnedProductID(productId).Exec(ctx)
	})
	if err != nil {
		return nil, err
	}
	return application.ListLiveProducts(ctx, liveId)
}

func (application *LiveApplication) ListLiveProducts(ctx context.Context, liveId uuid.UUID) ([]LiveProductView, error) {
	rows, err := application.Client.LiveProduct.Query().Where(liveproduct.LiveID(liveId)).Order(ent.Asc(liveproduct.FieldCreatedAt)).All(ctx)
	if err != nil {
		return nil, err
	}
	views := make([]LiveProductView, 0, len(rows))
	for _, row := range rows {
		views = append(views, LiveProductView{ProductId: row.ProductID.String(), Pinned: row.Pinned})
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
	return unprocessable("PRODUCTS_REQUIRE_STORE", "Only accounts with a store can pin products.")
}
