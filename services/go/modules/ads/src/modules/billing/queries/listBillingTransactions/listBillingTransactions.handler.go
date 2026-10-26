package listbillingtransactions

import (
	"context"
	"time"

	"entgo.io/ent/dialect/sql"

	"nantty/modules/ads/src/container"
	"nantty/modules/ads/src/generated/ent/adfundstransaction"
	accountservices "nantty/modules/ads/src/modules/adAccounts/services"
	"nantty/modules/ads/src/modules/billing/dtos"
	billingservices "nantty/modules/ads/src/modules/billing/services"
	adsservices "nantty/modules/ads/src/services"
	"nantty/modules/ads/src/types"
	"nantty/modules/ads/src/utils"
)

type Handler struct{ Container *container.Container }

func (handler Handler) Execute(ctx context.Context, query Query) ([]dtos.BillingTransaction, string, error) {
	deployed := handler.Container
	if _, _, err := accountservices.LoadAccountForPermission(ctx, deployed, query.AccountId, query.UserId, adsservices.PermissionBillingView); err != nil {
		return nil, "", err
	}
	request := deployed.Client.AdFundsTransaction.Query().Where(adfundstransaction.AccountID(query.AccountId))
	if query.Cursor != nil {
		request.Where(adfundstransaction.IDLT(*query.Cursor))
	}
	rows, err := request.Order(adfundstransaction.ByID(sql.OrderDesc())).Limit(query.Limit + 1).All(ctx)
	if err != nil {
		return nil, "", err
	}
	next := ""
	if len(rows) > query.Limit {
		rows = rows[:query.Limit]
		next = utils.EncodeCursor(rows[len(rows)-1].ID)
	}
	items := make([]dtos.BillingTransaction, 0, len(rows))
	for _, row := range rows {
		items = append(items, dtos.BillingTransaction{Id: row.ID.String(), Type: string(row.Type), Amount: types.Money{AmountMinor: row.AmountMinor, Currency: row.Currency}, Description: row.Description, Reference: row.Reference, CreatedAt: row.CreatedAt.UTC().Format(time.RFC3339), ReceiptAvailable: billingservices.ReceiptedTransactionTypes[string(row.Type)]})
	}
	return items, next, nil
}
