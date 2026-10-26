package listsuppliers

import (
	"context"

	"github.com/google/uuid"

	"nantty/modules/inventory/src/container"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/predicate"
	"nantty/modules/inventory/src/generated/ent/supplier"
	"nantty/modules/inventory/src/services"
	"nantty/modules/inventory/src/types"
	"nantty/modules/inventory/src/utils"
	"nantty/platform/commerceports"
	"nantty/platform/httpserver"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, query Query) (httpserver.CursorPage[types.SupplierView], error) {
	empty := httpserver.CursorPage[types.SupplierView]{}
	conditions := []predicate.Supplier{supplier.StoreID(query.StoreId)}
	if query.Text != "" {
		conditions = append(conditions, supplier.Or(supplier.NameContainsFold(query.Text), supplier.ContactNameContainsFold(query.Text), supplier.PhoneContains(query.Text)))
	}
	after, err := utils.DecodeIdentifierCursor(query.Cursor)
	if err != nil {
		return empty, err
	}
	if after != nil {
		conditions = append(conditions, supplier.IDLT(*after))
	}
	rows, err := handler.Container.Client.Supplier.Query().Where(conditions...).Order(ent.Desc(supplier.FieldID)).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return empty, err
	}
	identifiers := make([]uuid.UUID, 0, len(rows))
	for _, row := range rows {
		identifiers = append(identifiers, row.ID)
	}
	counts := map[uuid.UUID]int{}
	if catalog, catalogError := commerceports.Default.CatalogReader(); catalogError == nil {
		if found, countError := catalog.CountActiveProductsBySupplier(ctx, query.StoreId, identifiers); countError == nil {
			counts = found
		}
	}
	return utils.PageFromOverfetchedRows(rows, query.Limit,
		func(row *ent.Supplier) types.SupplierView { return services.SupplierView(row, counts[row.ID]) },
		func(row *ent.Supplier) string { return utils.IdentifierCursor(row.ID) }), nil
}
