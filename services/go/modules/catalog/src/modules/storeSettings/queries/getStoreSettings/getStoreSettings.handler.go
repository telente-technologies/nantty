package getstoresettings

import (
	"context"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/modules/storeSettings/dtos"
	"nantty/modules/catalog/src/modules/storeSettings/services"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (dtos.StoreSettingsView, error) {
	row, err := handler.Container.Client.Store.Get(ctx, query.Store.StoreId)
	if err != nil {
		return dtos.StoreSettingsView{}, err
	}
	return services.PresentStoreSettings(ctx, row)
}
