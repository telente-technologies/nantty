package setbrandselling

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/enums"
	catalogerrors "zudomart/modules/catalog/src/errors"
	"zudomart/modules/catalog/src/events"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/brand"
	"zudomart/modules/catalog/src/generated/ent/store"
	brandservices "zudomart/modules/catalog/src/modules/brands/services"
)

const pausedReason = "Brand selling is turned off."

type Command struct {
	AccountId      uuid.UUID
	BrandId        uuid.UUID
	SellingEnabled bool
}

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (brandservices.BrandDetail, error) {
	if command.SellingEnabled {
		status, err := handler.Container.LinkedProfiles.StatusOf(ctx, command.AccountId, "brand", command.BrandId)
		if err != nil {
			return brandservices.BrandDetail{}, err
		}
		if status == "held" || status == "retired" {
			return brandservices.BrandDetail{}, catalogerrors.ProfileOnHold
		}
	}
	err := handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		row, err := tx.Brand.Query().Where(brand.ID(command.BrandId), brand.Active(true)).ForUpdate().Only(ctx)
		if ent.IsNotFound(err) {
			return catalogerrors.BrandNotFound
		}
		if err != nil {
			return err
		}
		if row.OwnerAccountID == nil || *row.OwnerAccountID != command.AccountId {
			return catalogerrors.BrandNotOwned
		}
		if row.SellingEnabled == command.SellingEnabled {
			return nil
		}
		if err := row.Update().SetSellingEnabled(command.SellingEnabled).Exec(ctx); err != nil {
			return err
		}
		if err := handler.syncStorefronts(ctx, tx, row.ID, command.SellingEnabled); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "brand.updated", row.ID.String(), handler.Container.Now(), map[string]any{"brandId": row.ID, "sellingEnabled": command.SellingEnabled})
	})
	if err != nil {
		return brandservices.BrandDetail{}, err
	}
	row, err := handler.Container.Client.Brand.Get(ctx, command.BrandId)
	if err != nil {
		return brandservices.BrandDetail{}, err
	}
	return brandservices.Detail(ctx, handler.Container, row, &command.AccountId)
}

func (handler Handler) syncStorefronts(ctx context.Context, tx *ent.Tx, brandId uuid.UUID, enabled bool) error {
	now := handler.Container.Now()
	from, to := enums.StoreActive, enums.StorePaused
	if enabled {
		from, to = enums.StorePaused, enums.StoreActive
	}
	rows, err := tx.Store.Query().Where(store.BrandID(brandId), store.Channel(enums.ChannelBrand), store.Status(from)).All(ctx)
	if err != nil {
		return err
	}
	for _, row := range rows {
		update := row.Update().SetStatus(to).SetStatusChangedAt(now)
		if enabled {
			update.ClearStatusReason()
		} else {
			update.SetStatusReason(pausedReason)
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		payload := map[string]any{"storeId": row.ID, "ownerAccountId": row.OwnerAccountID, "status": to, "previousStatus": from, "reason": pausedReason}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "store.statusChanged", row.ID.String(), now, payload); err != nil {
			return err
		}
		if err := events.EnqueueOutboxEventInTransaction(ctx, tx, "store.updated", row.ID.String(), now, map[string]any{"storeId": row.ID}); err != nil {
			return err
		}
	}
	return nil
}
