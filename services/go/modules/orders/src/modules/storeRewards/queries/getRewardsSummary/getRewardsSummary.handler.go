package getrewardssummary

import (
	"context"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/modules/orders/src/enums"
	"nantty/modules/orders/src/generated/ent"
	"nantty/modules/orders/src/generated/ent/storecreditentry"
	"nantty/modules/orders/src/services"
	"nantty/platform/money"
)

type Handler struct {
	Container *container.Container
}

type Summary struct {
	OutstandingLiability money.Money `json:"outstandingLiability"`
	CustomersWithCredit  int         `json:"customersWithCredit"`
	IssuedLast30Days     money.Money `json:"issuedLast30Days"`
	RedeemedLast30Days   money.Money `json:"redeemedLast30Days"`
}

func (handler Handler) Execute(ctx context.Context, query Query) (Summary, error) {
	currency := query.Store.Currency
	summary := Summary{OutstandingLiability: money.Money{Currency: currency}, IssuedLast30Days: money.Money{Currency: currency}, RedeemedLast30Days: money.Money{Currency: currency}}
	now := handler.Container.Now()
	var after *uuid.UUID
	byBuyer := map[uuid.UUID][]services.CreditEntry{}
	since := now.AddDate(0, 0, -30)
	for {
		request := handler.Container.Client.StoreCreditEntry.Query().Where(storecreditentry.StoreID(query.Store.StoreId)).Order(ent.Asc(storecreditentry.FieldID)).Limit(5000)
		if after != nil {
			request = request.Where(storecreditentry.IDGT(*after))
		}
		rows, err := request.All(ctx)
		if err != nil {
			return summary, err
		}
		if len(rows) == 0 {
			break
		}
		for _, row := range rows {
			byBuyer[row.BuyerAccountID] = append(byBuyer[row.BuyerAccountID], services.CreditEntry{Kind: row.Kind, AmountMinor: row.AmountMinor, ExpiresAt: row.ExpiresAt, CreatedAt: row.CreatedAt})
			addRecent(&summary, row, since)
		}
		after = &rows[len(rows)-1].ID
	}
	for _, entries := range byBuyer {
		if state := services.ComputeCreditState(entries, now); state.BalanceMinor > 0 {
			summary.OutstandingLiability.AmountMinor += state.BalanceMinor
			summary.CustomersWithCredit++
		}
	}
	return summary, nil
}

func addRecent(summary *Summary, row *ent.StoreCreditEntry, since time.Time) {
	if row.CreatedAt.Before(since) {
		return
	}
	switch row.Kind {
	case enums.CreditEarn:
		summary.IssuedLast30Days.AmountMinor += row.AmountMinor
	case enums.CreditRedeem:
		summary.RedeemedLast30Days.AmountMinor += row.AmountMinor
	}
}
