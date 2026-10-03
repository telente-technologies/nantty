package createsupplier

import (
	"context"
	"strings"

	"zudomart/modules/inventory/src/container"
	"zudomart/modules/inventory/src/services"
	"zudomart/modules/inventory/src/types"
)

type Handler struct {
	Container *container.Container
}

func (handler Handler) Execute(ctx context.Context, command Command) (types.SupplierView, error) {
	request := command.Request
	row, err := handler.Container.Client.Supplier.Create().SetStoreID(command.Store.StoreId).SetName(strings.TrimSpace(request.Name)).
		SetContactName(request.ContactName).SetPhone(request.Phone).SetNillableEmail(request.Email).SetAddress(request.Address).
		SetLeadTimeDays(request.LeadTimeDays).SetPaymentTerms(request.PaymentTerms).SetNillableNotes(request.Notes).Save(ctx)
	if err != nil {
		return types.SupplierView{}, err
	}
	return services.SupplierView(row, 0), nil
}
