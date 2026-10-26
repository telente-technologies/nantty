package listreordersuggestions

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/inventory/src/generated/ent/supplier"
	"nantty/modules/inventory/src/types"
	"nantty/platform/commerceports"
)

func (handler Handler) loadSuppliers(ctx context.Context, storeId uuid.UUID, descriptions map[uuid.UUID]commerceports.VariantDescription) (map[uuid.UUID]*types.ReorderSupplierView, error) {
	identifiers := []uuid.UUID{}
	for _, description := range descriptions {
		if description.SupplierId != nil {
			identifiers = append(identifiers, *description.SupplierId)
		}
	}
	rows, err := handler.Container.Client.Supplier.Query().Where(supplier.StoreID(storeId), supplier.IDIn(identifiers...)).All(ctx)
	if err != nil {
		return nil, err
	}
	views := map[uuid.UUID]*types.ReorderSupplierView{}
	for _, row := range rows {
		views[row.ID] = &types.ReorderSupplierView{Id: row.ID.String(), Name: row.Name, LeadTimeDays: row.LeadTimeDays}
	}
	return views, nil
}
