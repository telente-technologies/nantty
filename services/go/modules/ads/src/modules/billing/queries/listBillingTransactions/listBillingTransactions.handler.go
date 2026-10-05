package listbillingtransactions

import (
	"context"
	"time"

	"entgo.io/ent/dialect/sql"

	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent/adfundstransaction"
	accountservices "zudomart/modules/ads/src/modules/adAccounts/services"
	"zudomart/modules/ads/src/modules/billing/dtos"
	billingservices "zudomart/modules/ads/src/modules/billing/services"
	adsservices "zudomart/modules/ads/src/services"
	"zudomart/modules/ads/src/types"
	"zudomart/modules/ads/src/utils"
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
