package updatesupplier

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"nantty/modules/inventory/src/container"
	inventoryerrors "nantty/modules/inventory/src/errors"
	"nantty/modules/inventory/src/generated/ent"
	"nantty/modules/inventory/src/generated/ent/supplier"
	"nantty/modules/inventory/src/services"
	"nantty/modules/inventory/src/types"
	"nantty/platform/commerceports"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.SupplierView, error) {
	request := command.Request
	existing, err := handler.Container.Client.Supplier.Query().Where(supplier.ID(command.SupplierId), supplier.StoreID(command.Store.StoreId)).Only(ctx)
	if ent.IsNotFound(err) {
		return types.SupplierView{}, inventoryerrors.SupplierNotFound
	}
	if err != nil {
		return types.SupplierView{}, err
	}
	update := existing.Update().SetName(strings.TrimSpace(request.Name)).SetContactName(request.ContactName).SetPhone(request.Phone).SetAddress(request.Address).
		SetLeadTimeDays(request.LeadTimeDays).SetPaymentTerms(request.PaymentTerms).SetNillableEmail(request.Email).SetNillableNotes(request.Notes)
	if request.Email == nil {
		update.ClearEmail()
	}
	if request.Notes == nil {
		update.ClearNotes()
	}
	row, err := update.Save(ctx)
	if err != nil {
		return types.SupplierView{}, err
	}
	if catalog, catalogError := commerceports.Default.CatalogReader(); catalogError == nil {
		if found, countError := catalog.CountActiveProductsBySupplier(ctx, command.Store.StoreId, []uuid.UUID{row.ID}); countError == nil {
			return services.SupplierView(row, found[row.ID]), nil
		}
	}
	return services.SupplierView(row, 0), nil
}
