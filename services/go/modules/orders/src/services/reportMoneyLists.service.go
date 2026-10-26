package services

import (
	"context"
	"net/url"
	"time"

	"github.com/google/uuid"

	"nantty/modules/orders/src/container"
	"nantty/platform/commerceports"
	"nantty/platform/money"
)

type refundSource struct {
	OrderNumber string      `json:"orderNumber"`
	BuyerName   string      `json:"buyerName"`
	Kind        string      `json:"kind"`
	Reason      string      `json:"reason"`
	Amount      money.Money `json:"amount"`
	CreatedAt   string      `json:"createdAt"`
}

func refundsReport(ctx context.Context, deployed *container.Container, data ReportData, store commerceports.StoreAccess, actorId uuid.UUID) (ReportResult, error) {
	result := data.base("refunds", "Refunds", []ReportColumn{{"date", "Date", "date"}, {"order", "Order", "text"}, {"customer", "Customer", "text"}, {"kind", "Kind", "text"},
		{"reason", "Reason", "text"}, {"amount", "Amount", "money"}})
	query := url.Values{"from": {data.From.Format(time.DateOnly)}, "to": {data.To.Format(time.DateOnly)}, "limit": {"50"}}
	rows, err := collectSellerMoneyPages[refundSource](ctx, deployed, store, actorId, "/finance/refunds", query)
	if err != nil {
		return result, err
	}
	amounts := []money.Money{}
	for _, row := range rows {
		day, _ := data.dayInRange(row.CreatedAt)
		result.Rows = append(result.Rows, map[string]any{"date": day, "order": row.OrderNumber, "customer": row.BuyerName, "kind": row.Kind, "reason": row.Reason, "amount": row.Amount})
		amounts = append(amounts, row.Amount)
	}
	result.Totals = map[string]any{"date": "Total", "amount": sumMoney(data.Currency, amounts...)}
	return result, nil
}

type payoutSource struct {
	Reference      string      `json:"reference"`
	AccountSummary string      `json:"accountSummary"`
	Status         string      `json:"status"`
	Amount         money.Money `json:"amount"`
	Fee            money.Money `json:"fee"`
	RequestedAt    string      `json:"requestedAt"`
}

func payoutsReport(ctx context.Context, deployed *container.Container, data ReportData, store commerceports.StoreAccess, actorId uuid.UUID) (ReportResult, error) {
	result := data.base("payouts", "Payouts", []ReportColumn{{"requestedAt", "Requested", "date"}, {"reference", "Reference", "text"}, {"account", "Account", "text"},
		{"status", "Status", "text"}, {"amount", "Amount", "money"}, {"fee", "Fee", "money"}})
	rows, err := collectSellerMoneyPages[payoutSource](ctx, deployed, store, actorId, "/wallet/payouts", url.Values{"limit": {"25"}})
	if err != nil {
		return result, err
	}
	amounts, fees := []money.Money{}, []money.Money{}
	for _, row := range rows {
		day, inRange := data.dayInRange(row.RequestedAt)
		if !inRange {
			continue
		}
		result.Rows = append(result.Rows, map[string]any{"requestedAt": day, "reference": row.Reference, "account": row.AccountSummary, "status": row.Status, "amount": row.Amount, "fee": row.Fee})
		amounts, fees = append(amounts, row.Amount), append(fees, row.Fee)
	}
	result.Totals = map[string]any{"requestedAt": "Total", "amount": sumMoney(data.Currency, amounts...), "fee": sumMoney(data.Currency, fees...)}
	return result, nil
}

type campaignSource struct {
	Campaign    string      `json:"campaign"`
	Status      string      `json:"status"`
	Spend       money.Money `json:"spend"`
	Impressions int64       `json:"impressions"`
	Clicks      int64       `json:"clicks"`
	Orders      int         `json:"orders"`
	Revenue     money.Money `json:"revenue"`
}

func adsCampaignsReport(ctx context.Context, deployed *container.Container, data ReportData, store commerceports.StoreAccess) (ReportResult, error) {
	result := data.base("ads-campaigns", "Ad campaigns", []ReportColumn{{"campaign", "Campaign", "text"}, {"status", "Status", "text"}, {"spend", "Spend", "money"},
		{"impressions", "Impressions", "number"}, {"clicks", "Clicks", "number"}, {"clickThroughRate", "CTR", "percent"}, {"orders", "Orders", "number"},
		{"revenue", "Revenue", "money"}, {"roas", "ROAS", "number"}})
	var page struct {
		Data []campaignSource `json:"data"`
	}
	query := url.Values{"from": {data.From.Format(time.DateOnly)}, "to": {data.To.Format(time.DateOnly)}}
	path := "/api/v1/internal/stores/" + store.StoreId.String() + "/campaign-report?" + query.Encode()
	if err := internalGet(ctx, deployed.Settings.AdsInternalUrl, path, deployed.Settings.AdsInternalToken, nil, &page); err != nil {
		return result, err
	}
	for _, row := range page.Data {
		var roas any
		if row.Spend.AmountMinor > 0 {
			roas = float64(row.Revenue.AmountMinor*100/row.Spend.AmountMinor) / 100
		}
		result.Rows = append(result.Rows, map[string]any{"campaign": row.Campaign, "status": row.Status, "spend": row.Spend, "impressions": row.Impressions, "clicks": row.Clicks,
			"clickThroughRate": basisPoints(row.Clicks, row.Impressions), "orders": row.Orders, "revenue": row.Revenue, "roas": roas})
	}
	return result, nil
}
