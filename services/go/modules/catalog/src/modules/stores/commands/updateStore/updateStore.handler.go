package updatestore

import (
	"context"
	"strings"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/events"
	"nantty/modules/catalog/src/generated/ent"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) error {
	request := command.Request
	return handler.Container.RunInTransaction(ctx, func(tx *ent.Tx) error {
		update := tx.Store.UpdateOneID(command.Store.StoreId)
		if request.Name != nil {
			update.SetName(strings.TrimSpace(*request.Name))
		}
		if request.Description != nil {
			update.SetDescription(*request.Description)
		}
		if request.LogoUrl != nil {
			if *request.LogoUrl == "" {
				update.ClearLogoURL()
			} else {
				update.SetLogoURL(*request.LogoUrl)
			}
		}
		if request.BannerUrl != nil {
			if *request.BannerUrl == "" {
				update.ClearBannerURL()
			} else {
				update.SetBannerURL(*request.BannerUrl)
			}
		}
		if err := update.Exec(ctx); err != nil {
			return err
		}
		return events.EnqueueOutboxEventInTransaction(ctx, tx, "store.updated", command.Store.StoreId.String(), handler.Container.Now(), map[string]any{"storeId": command.Store.StoreId})
	})
}
