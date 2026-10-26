package listinvoices

import (
	"context"

	"nantty/modules/ads/src/container"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/billing/dtos"
	"nantty/modules/ads/src/modules/billing/services"
	adsservices "nantty/modules/ads/src/services"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.Invoice, string, error) {
	deployed := handler.Container
	account, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionBillingView)
	if err != nil {
		return nil, "", err
	}
	invoices, err := services.BuildMonthlyInvoices(ctx, deployed.Database, account, deployed.Now())
	if err != nil {
		return nil, "", err
	}
	start := 0
	if query.Cursor != "" {
		for index, invoice := range invoices {
			if invoice.Id == query.Cursor {
				start = index + 1
				break
			}
		}
	}
	page := invoices[min(start, len(invoices)):min(start+query.Limit, len(invoices))]
	next := ""
	if start+query.Limit < len(invoices) && len(page) > 0 {
		next = page[len(page)-1].Id
	}
	return page, next, nil
}
