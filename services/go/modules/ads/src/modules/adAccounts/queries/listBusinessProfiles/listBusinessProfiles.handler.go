package listbusinessprofiles

import (
	"context"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/modules/adAccounts/dtos"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.LinkedBusinessProfile, error) {
	stores, err := handler.Container.Stores.ListStoresManagedBy(ctx, query.UserId.String())
	if err != nil {
		return nil, err
	}
	profiles := make([]dtos.LinkedBusinessProfile, 0, len(stores))
	for _, store := range stores {
		profiles = append(profiles, dtos.LinkedBusinessProfile{StoreId: store.StoreId, StoreName: store.Name, Handle: store.Handle, LogoUrl: store.LogoUrl, GoldVerified: store.GoldVerified, CountryCode: store.CountryCode})
	}
	return profiles, nil
}
