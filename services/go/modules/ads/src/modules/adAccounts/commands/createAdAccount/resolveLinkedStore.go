package createadaccount

import (
	"context"

	"zudomart/modules/ads/src/generated/ent/adaccount"
	"zudomart/modules/ads/src/interfaces"
	"zudomart/platform/httpserver"
)

func (handler Handler) resolveLinkedStore(ctx context.Context, command Command) (*interfaces.ManagedStore, error) {
	if command.Request.StoreId == nil || *command.Request.StoreId == "" {
		return nil, nil
	}
	stores, err := handler.Container.Stores.ListStoresManagedBy(ctx, command.UserId.String())
	if err != nil {
		return nil, err
	}
	for _, store := range stores {
		if store.StoreId == *command.Request.StoreId {
			return &store, nil
		}
	}
	return nil, httpserver.NewValidationFailedError([]httpserver.ValidationIssue{{Path: "storeId", Message: "You do not own or manage this store."}})
}

func adaccountKind(kind string) adaccount.Kind { return adaccount.Kind(kind) }
